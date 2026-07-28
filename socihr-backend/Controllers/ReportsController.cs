using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Helpers;
using socihr_backend.Models;
using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ReportsController(AppDbContext db) => _db = db;

    // ─── Shared Excel styling helpers ─────────────────────────────
    private static XLColor Html(string hex) => XLColor.FromHtml(hex);

    private static void StyleCell(IXLCell cell, string bg, string fg, bool bold, float size, XLBorderStyleValues border = XLBorderStyleValues.Thin)
    {
        cell.Style.Font.Bold = bold;
        cell.Style.Font.FontSize = size;
        cell.Style.Font.FontColor = Html(fg);
        cell.Style.Fill.BackgroundColor = Html(bg);
        cell.Style.Alignment.SetVertical(XLAlignmentVerticalValues.Center);
        if (border != XLBorderStyleValues.None)
        {
            cell.Style.Border.SetLeftBorder(border).Border.SetLeftBorderColor(Html("#cbd5e1"));
            cell.Style.Border.SetRightBorder(border).Border.SetRightBorderColor(Html("#cbd5e1"));
            cell.Style.Border.SetTopBorder(border).Border.SetTopBorderColor(Html("#cbd5e1"));
            cell.Style.Border.SetBottomBorder(border).Border.SetBottomBorderColor(Html("#cbd5e1"));
        }
    }

    private static void WriteSectionTitle(IXLWorksheet ws, int row, int col, string title, string color)
    {
        ws.Cell(row, col).Value = title;
        ws.Cell(row, col).Style.Font.Bold = true;
        ws.Cell(row, col).Style.Font.FontSize = 13;
        ws.Cell(row, col).Style.Font.FontColor = Html(color);
    }

    private static void WriteTableHeader(IXLWorksheet ws, int row, int startCol, string[] headers, string bg, string fg)
    {
        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(row, startCol + i);
            cell.Value = headers[i];
            StyleCell(cell, bg, fg, true, 10);
            cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
        }
    }

    private static void WriteDataRow(IXLWorksheet ws, int row, int startCol, object[] values, string evenBg, string oddBg, bool isEven)
    {
        var bg = isEven ? evenBg : oddBg;
        for (int i = 0; i < values.Length; i++)
        {
            var cell = ws.Cell(row, startCol + i);
            if (values[i] is string s)
                cell.SetValue(s);
            else if (values[i] is int iv)
                cell.SetValue(iv);
            else if (values[i] is double dv)
                cell.SetValue(dv);
            else
                cell.SetValue(values[i]?.ToString() ?? "");
            StyleCell(cell, bg, "#1e293b", false, 9);
            if (i == 0) cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
        }
    }

    // GET /api/reports/excel?from=2026-01-01&to=2026-12-31
    [HttpGet("excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var staffList = await _db.Staff
            .Where(s => !s.IsArchived)
            .ToDictionaryAsync(s => s.StaffID);

        var ranking = await StaffRankingHelper.GetRanking(_db, "top", null, from, to);

        var staffPerf = ranking.Select((d, idx) =>
        {
            var staff = staffList.TryGetValue(d.StaffID, out var s) ? s : null;
            var missed = d.Total - d.Completed;
            return new StaffPerformanceDto
            {
                Rank = idx + 1,
                StaffID = d.StaffID,
                FullName = d.FullName,
                Department = d.Department ?? "-",
                Position = staff?.Position ?? "-",
                Status = staff?.Status ?? "Active",
                Completed = d.Completed,
                Missed = missed,
                Total = d.Total,
                CompletionRate = d.CompletionRate
            };
        }).ToList();

        var totalCompleted = staffPerf.Sum(s => s.Completed);
        var totalMissed = staffPerf.Sum(s => s.Missed);
        var totalExpected = totalCompleted + totalMissed;
        var overallRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100) : 0;

        var platformStats = await GetPlatformStatsAsync(from, to);
        var companyStats = await GetCompanyStatsAsync(from, to);
        var dailyStats = await GetDailyStatsAsync(from, to);

        // Load monitoring sessions for the period
        var sessionQuery = _db.MonitoringSessions.AsQueryable();
        if (from.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate >= DateOnly.FromDateTime(from.Value));
        if (to.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate <= DateOnly.FromDateTime(to.Value));
        var monitoringSessions = await sessionQuery.OrderBy(s => s.SessionDate).ToListAsync();
        var sessionIds = monitoringSessions.Select(s => s.SessionID).ToList();
        var monitoringEngagements = await _db.Engagements
            .AsNoTracking()
            .Include(e => e.Staff)
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Post).ThenInclude(p => p!.Company)
            .Where(e => sessionIds.Contains(e.SessionID))
            .ToListAsync();

        var dateRange = $"{from?.ToString("dd/MM/yyyy") ?? "All"} - {to?.ToString("dd/MM/yyyy") ?? "All"}";
        var accentColors = new[] { "#1e40af", "#059669", "#d97706", "#7c3aed", "#dc2626" };

        using var workbook = new XLWorkbook();

        // ════════════════════════════════════════════════════════════
        // Sheet 1: Summary & Rankings
        // ════════════════════════════════════════════════════════════
        var ws1 = workbook.Worksheets.Add("Summary & Rankings");
        ws1.Cell(1, 1).Value = "SociHR — Performance & Engagement Summary";
        StyleCell(ws1.Cell(1, 1), "#ffffff", "#1e40af", true, 18, XLBorderStyleValues.None);
        ws1.Cell(2, 1).Value = $"Period: {dateRange}";
        StyleCell(ws1.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);
        ws1.Cell(3, 1).Value = $"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}  •  System crafted by @syaakiirr";
        StyleCell(ws1.Cell(3, 1), "#ffffff", "#94a3b8", false, 9, XLBorderStyleValues.None);

        // KPI row
        var kpiHeaders = new[] { "Total Staff", "Completed", "Missed", "Expected", "Overall Rate" };
        var kpiValues = new object[] { staffPerf.Count, totalCompleted, totalMissed, totalExpected, $"{overallRate}%" };
        var kpiColors = new[] { "#6366f1", "#16a34a", "#dc2626", "#d97706", "#7c3aed" };
        for (int i = 0; i < kpiHeaders.Length; i++)
        {
            var headerCell = ws1.Cell(5, i + 1);
            headerCell.Value = kpiHeaders[i];
            StyleCell(headerCell, "#f1f5f9", "#475569", true, 9);
            headerCell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

            var valCell = ws1.Cell(6, i + 1);
            var kv = kpiValues[i];
            if (kv is string s) valCell.SetValue(s);
            else if (kv is int iv) valCell.SetValue(iv);
            else valCell.SetValue(kv?.ToString() ?? "");
            StyleCell(valCell, "#ffffff", kpiColors[i], true, 16);
            valCell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
        }

        // Top Performers
        var topRow = 8;
        WriteSectionTitle(ws1, topRow, 1, "Top Performing Staff (Best 10)", "#16a34a");
        var rankHeaders = new[] { "Rank", "Name", "Department", "Position", "Completed", "Expected", "Rate (%)" };
        WriteTableHeader(ws1, topRow + 1, 1, rankHeaders, "#16a34a", "#ffffff");
        var top10 = staffPerf.Take(10).ToList();
        for (int i = 0; i < top10.Count; i++)
        {
            var r = topRow + 2 + i;
            WriteDataRow(ws1, r, 1, new object[] { top10[i].Rank, top10[i].FullName, top10[i].Department, top10[i].Position, top10[i].Completed, top10[i].Total, $"{top10[i].CompletionRate}%" }, "#f0fdf4", "#ffffff", i % 2 == 0);
            ws1.Cell(r, 7).Style.Font.FontColor = Html("#16a34a");
            ws1.Cell(r, 7).Style.Font.Bold = true;
        }

        // Bottom Performers
        var botRow = topRow + 2 + Math.Max(top10.Count, 1) + 2;
        WriteSectionTitle(ws1, botRow, 1, "Least Performing Staff (Bottom 10)", "#dc2626");
        WriteTableHeader(ws1, botRow + 1, 1, rankHeaders, "#dc2626", "#ffffff");
        var bottom10 = staffPerf.AsEnumerable().Reverse().Take(10).Reverse().ToList();
        for (int i = 0; i < bottom10.Count; i++)
        {
            var r = botRow + 2 + i;
            WriteDataRow(ws1, r, 1, new object[] { bottom10[i].Rank, bottom10[i].FullName, bottom10[i].Department, bottom10[i].Position, bottom10[i].Completed, bottom10[i].Total, $"{bottom10[i].CompletionRate}%" }, "#fef2f2", "#ffffff", i % 2 == 0);
            ws1.Cell(r, 7).Style.Font.FontColor = Html("#dc2626");
            ws1.Cell(r, 7).Style.Font.Bold = true;
        }

        ws1.Columns().AdjustToContents();

        // ════════════════════════════════════════════════════════════
        // Sheet 2: All Staff Performance
        // ════════════════════════════════════════════════════════════
        var ws2 = workbook.Worksheets.Add("All Staff Performance");
        ws2.Cell(1, 1).Value = "All Staff — Detailed Performance";
        StyleCell(ws2.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);
        ws2.Cell(2, 1).Value = $"Period: {dateRange}";
        StyleCell(ws2.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);

        var detailHeaders = new[] { "Rank", "Name", "Department", "Position", "Status", "Completed", "Missed", "Expected", "Rate (%)" };
        WriteTableHeader(ws2, 4, 1, detailHeaders, "#7c3aed", "#ffffff");
        for (int i = 0; i < staffPerf.Count; i++)
        {
            var r = 5 + i;
            var s = staffPerf[i];
            WriteDataRow(ws2, r, 1, new object[] { s.Rank, s.FullName, s.Department, s.Position, s.Status, s.Completed, s.Missed, s.Total, $"{s.CompletionRate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
            var rateColor = s.CompletionRate >= 80 ? "#16a34a" : s.CompletionRate >= 50 ? "#d97706" : "#dc2626";
            ws2.Cell(r, 9).Style.Font.FontColor = Html(rateColor);
            ws2.Cell(r, 9).Style.Font.Bold = true;
        }

        ws2.Columns().AdjustToContents();

        // ════════════════════════════════════════════════════════════
        // Sheet 3: Platform & Company Stats
        // ════════════════════════════════════════════════════════════
        var ws3 = workbook.Worksheets.Add("Platform & Company");
        ws3.Cell(1, 1).Value = "Platform & Company Engagement Breakdown";
        StyleCell(ws3.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);

        WriteSectionTitle(ws3, 3, 1, "Engagement Ticks by Platform", "#7c3aed");
        var platHeaders = new[] { "Platform", "Completed", "Missed", "Expected", "Rate (%)" };
        WriteTableHeader(ws3, 4, 1, platHeaders, "#7c3aed", "#ffffff");
        for (int i = 0; i < platformStats.Count; i++)
        {
            var r = 5 + i;
            var p = platformStats[i];
            WriteDataRow(ws3, r, 1, new object[] { p.Platform, p.Completed, p.Missed, p.Total, $"{p.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
            var rateColor = p.Rate >= 80 ? "#16a34a" : p.Rate >= 50 ? "#d97706" : "#dc2626";
            ws3.Cell(r, 5).Style.Font.FontColor = Html(rateColor);
            ws3.Cell(r, 5).Style.Font.Bold = true;
        }

        var coTitleRow = 5 + Math.Max(platformStats.Count, 1) + 2;
        WriteSectionTitle(ws3, coTitleRow, 1, "Engagement Ticks by Company", "#7c3aed");
        var coHeaders = new[] { "Company", "Completed", "Missed", "Expected", "Rate (%)" };
        WriteTableHeader(ws3, coTitleRow + 1, 1, coHeaders, "#7c3aed", "#ffffff");
        for (int i = 0; i < companyStats.Count; i++)
        {
            var r = coTitleRow + 2 + i;
            var c = companyStats[i];
            WriteDataRow(ws3, r, 1, new object[] { c.Company, c.Completed, c.Missed, c.Total, $"{c.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
            var rateColor = c.Rate >= 80 ? "#16a34a" : c.Rate >= 50 ? "#d97706" : "#dc2626";
            ws3.Cell(r, 5).Style.Font.FontColor = Html(rateColor);
            ws3.Cell(r, 5).Style.Font.Bold = true;
        }

        ws3.Columns().AdjustToContents();

        // ════════════════════════════════════════════════════════════
        // Sheet 4: Daily Engagement
        // ════════════════════════════════════════════════════════════
        var ws4 = workbook.Worksheets.Add("Daily Engagement");
        ws4.Cell(1, 1).Value = "Daily Engagement Breakdown";
        StyleCell(ws4.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);

        var dailyHeaders = new[] { "Date", "Sessions", "Completed", "Missed", "Expected", "Rate (%)" };
        WriteTableHeader(ws4, 3, 1, dailyHeaders, "#7c3aed", "#ffffff");
        if (dailyStats.Count == 0)
        {
            ws4.Cell(4, 1).Value = "No sessions found in this date range.";
            StyleCell(ws4.Cell(4, 1), "#ffffff", "#94a3b8", true, 10, XLBorderStyleValues.None);
        }
        else
        {
            for (int i = 0; i < dailyStats.Count; i++)
            {
                var r = 4 + i;
                var d = dailyStats[i];
                WriteDataRow(ws4, r, 1, new object[] { d.Date.ToString("dd/MM/yyyy"), d.SessionCount, d.Completed, d.Missed, d.Total, d.Rate / 100.0 }, "#f8fafc", "#ffffff", i % 2 == 0);
                ws4.Cell(r, 3).Style.Font.FontColor = Html("#16a34a");
                ws4.Cell(r, 4).Style.Font.FontColor = Html("#dc2626");
                ws4.Cell(r, 6).Style.NumberFormat.Format = "0.0%";
                ws4.Cell(r, 6).Style.Font.Bold = true;
            }

            var rateRange = ws4.Range(4, 6, 3 + dailyStats.Count, 6);
            rateRange.AddConditionalFormat().ColorScale()
                .LowestValue(Html("#eef2ff"))
                .Midpoint(XLCFContentType.Percent, "50", Html("#a5b4fc"))
                .HighestValue(Html("#6366f1"));
        }

        ws4.Columns().AdjustToContents();

        // ════════════════════════════════════════════════════════════
        // Sheet 5+: Monitoring Sessions (one sheet per session)
        // ════════════════════════════════════════════════════════════
        for (int sIdx = 0; sIdx < monitoringSessions.Count; sIdx++)
        {
            var session = monitoringSessions[sIdx];
            var sessionEngs = monitoringEngagements.Where(e => e.SessionID == session.SessionID).ToList();
            var rd = MonitoringSessionController.BuildReportData(session, sessionEngs);
            var accent = accentColors[sIdx % accentColors.Length];
            var sheetName = $"Session {sIdx + 1} - {session.SessionDate:yyyy-MM-dd}";
            if (sheetName.Length > 31) sheetName = sheetName[..31];

            var ws = workbook.Worksheets.Add(sheetName);

            // Header
            ws.Cell(1, 1).Value = $"Monitoring Session — {session.SessionDate:dd MMMM yyyy}";
            StyleCell(ws.Cell(1, 1), accent, "#ffffff", true, 14, XLBorderStyleValues.None);
            ws.Range(1, 1, 1, 8).Merge();

            ws.Cell(2, 1).Value = $"Session {sIdx + 1} of {monitoringSessions.Count}";
            StyleCell(ws.Cell(2, 1), "#ffffff", "#64748b", false, 10, XLBorderStyleValues.None);

            // Summary Cards
            var scRow = 4;
            var summaryCards = new[] {
                ("Total Likes", rd.TotalLikes.ToString(), "#3b82f6"),
                ("Total Comments", rd.TotalComments.ToString(), "#0ea5e9"),
                ("Total Shares", rd.TotalShares.ToString(), "#10b981")
            };
            for (int ci = 0; ci < summaryCards.Length; ci++)
            {
                var (label, val, color) = summaryCards[ci];
                var c = ws.Cell(scRow, ci * 2 + 1);
                c.Value = label;
                StyleCell(c, "#f8fafc", color, true, 10);
                c.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                var vc = ws.Cell(scRow + 1, ci * 2 + 1);
                vc.Value = int.TryParse(val, out var n) ? n : val;
                StyleCell(vc, "#ffffff", color, true, 18);
                vc.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            }

            // Engagement Matrix Table
            int tableRow = scRow + 3;
            int col = 1;

            ws.Cell(tableRow, col).Value = "#";
            StyleCell(ws.Cell(tableRow, col), "#f1f5f9", "#475569", true, 8);
            ws.Range(tableRow, col, tableRow + 2, col).Merge();
            col++;

            ws.Cell(tableRow, col).Value = "Staff Name";
            StyleCell(ws.Cell(tableRow, col), "#f1f5f9", "#475569", true, 8);
            ws.Range(tableRow, col, tableRow + 2, col).Merge();
            col++;

            ws.Cell(tableRow, col).Value = "Dept";
            StyleCell(ws.Cell(tableRow, col), "#f1f5f9", "#475569", true, 8);
            ws.Range(tableRow, col, tableRow + 2, col).Merge();
            col++;

            int actionStartCol = col;

            // Company headers
            int companyRow = tableRow;
            foreach (var coGroup in rd.CompanyGroups)
            {
                var cell = ws.Cell(companyRow, col);
                cell.Value = coGroup.Name;
                StyleCell(cell, "#dbeafe", "#1e40af", true, 10);
                cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                if (coGroup.Span > 1)
                    ws.Range(companyRow, col, companyRow, col + coGroup.Span - 1).Merge();
                col += coGroup.Span;
            }

            int reasonCol = col;
            ws.Cell(tableRow, reasonCol).Value = "Reason";
            StyleCell(ws.Cell(tableRow, reasonCol), "#fef3c7", "#92400e", true, 9);
            ws.Range(tableRow, reasonCol, tableRow + 2, reasonCol).Merge();

            // Platform headers
            col = actionStartCol;
            int platformRow = tableRow + 1;
            foreach (var platGroup in rd.PlatformGroups)
            {
                var cell = ws.Cell(platformRow, col);
                cell.Value = platGroup.PlatformName;
                StyleCell(cell, "#e0f2fe", "#0369a1", true, 9);
                cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                if (platGroup.Span > 1)
                    ws.Range(platformRow, col, platformRow, col + platGroup.Span - 1).Merge();
                col += platGroup.Span;
            }

            // Action headers
            col = actionStartCol;
            int actionRow = tableRow + 2;
            foreach (var ac in rd.ActionColumns)
            {
                var cell = ws.Cell(actionRow, col);
                cell.Value = ac.ActionLabel;
                StyleCell(cell, "#f0fdf4", "#15803d", true, 8);
                cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                col++;
            }

            // Data rows
            int dataRow = tableRow + 3;
            for (int ri = 0; ri < rd.StaffRows.Count; ri++)
            {
                var staffRow = rd.StaffRows[ri];
                var bg = ri % 2 == 0 ? "#ffffff" : "#f8fafc";

                int dc = 1;
                ws.Cell(dataRow, dc).Value = ri + 1;
                StyleCell(ws.Cell(dataRow, dc), bg, "#64748b", false, 8);
                ws.Cell(dataRow, dc).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                dc++;

                ws.Cell(dataRow, dc).Value = staffRow.StaffName;
                StyleCell(ws.Cell(dataRow, dc), bg, "#1e293b", true, 8);
                dc++;

                ws.Cell(dataRow, dc).Value = staffRow.Department;
                StyleCell(ws.Cell(dataRow, dc), bg, "#475569", false, 8);
                dc++;

                for (int ei = 0; ei < staffRow.EngagementValues.Count; ei++)
                {
                    if (staffRow.EngagementValues[ei])
                    {
                        ws.Cell(dataRow, dc).Value = "✓";
                        ws.Cell(dataRow, dc).Style.Font.FontColor = Html("#ffffff");
                        ws.Cell(dataRow, dc).Style.Fill.BackgroundColor = Html("#10b981");
                        ws.Cell(dataRow, dc).Style.Font.Bold = true;
                    }
                    else
                    {
                        ws.Cell(dataRow, dc).Value = "";
                        ws.Cell(dataRow, dc).Style.Fill.BackgroundColor = Html(bg);
                    }
                    ws.Cell(dataRow, dc).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    ws.Cell(dataRow, dc).Style.Border.SetLeftBorder(XLBorderStyleValues.Thin).Border.SetLeftBorderColor(Html("#cbd5e1"));
                    ws.Cell(dataRow, dc).Style.Border.SetRightBorder(XLBorderStyleValues.Thin).Border.SetRightBorderColor(Html("#cbd5e1"));
                    ws.Cell(dataRow, dc).Style.Border.SetTopBorder(XLBorderStyleValues.Thin).Border.SetTopBorderColor(Html("#cbd5e1"));
                    ws.Cell(dataRow, dc).Style.Border.SetBottomBorder(XLBorderStyleValues.Thin).Border.SetBottomBorderColor(Html("#cbd5e1"));
                    dc++;
                }

                ws.Cell(dataRow, reasonCol).Value = staffRow.Reason ?? "";
                StyleCell(ws.Cell(dataRow, reasonCol), bg, "#475569", false, 7);
                dataRow++;
            }

            var fRow = dataRow + 2;
            ws.Cell(fRow, 1).Value = "@syaakiirr";
            StyleCell(ws.Cell(fRow, 1), "#ffffff", "#94a3b8", false, 7, XLBorderStyleValues.None);
            ws.Cell(fRow + 1, 1).Value = $"Generated {DateTime.UtcNow:dd MMMM yyyy HH:mm:ss} UTC";
            StyleCell(ws.Cell(fRow + 1, 1), "#ffffff", "#9ca3af", false, 8, XLBorderStyleValues.None);

            ws.Columns().AdjustToContents();
        }

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Seek(0, SeekOrigin.Begin);

        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"SociHR_Performance_Report_{DateTime.Now:yyyyMMdd}.xlsx");
    }

    // POST /api/reports/custom-excel — same toggle options as custom PDF
    [HttpPost("custom-excel")]
    public async Task<IActionResult> ExportCustomExcel([FromBody] CustomExcelReportRequest req)
    {
        var staffList = await _db.Staff
            .Where(s => !s.IsArchived)
            .ToDictionaryAsync(s => s.StaffID);

        var ranking = await StaffRankingHelper.GetRanking(_db, "top", null, req.DateFrom, req.DateTo);

        var staffPerf = ranking.Select((d, idx) =>
        {
            var staff = staffList.TryGetValue(d.StaffID, out var s) ? s : null;
            var missed = d.Total - d.Completed;
            return new StaffPerformanceDto
            {
                Rank = idx + 1,
                StaffID = d.StaffID,
                FullName = d.FullName,
                Department = d.Department ?? "-",
                Position = staff?.Position ?? "-",
                Status = staff?.Status ?? "Active",
                Completed = d.Completed,
                Missed = missed,
                Total = d.Total,
                CompletionRate = d.CompletionRate
            };
        }).ToList();

        var totalCompleted = staffPerf.Sum(s => s.Completed);
        var totalMissed = staffPerf.Sum(s => s.Missed);
        var totalExpected = totalCompleted + totalMissed;
        var overallRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100) : 0;

        var platformStats = req.IncludePlatformCompany ? await GetPlatformStatsAsync(req.DateFrom, req.DateTo) : new List<PlatformStatDto>();
        var companyStats = req.IncludePlatformCompany ? await GetCompanyStatsAsync(req.DateFrom, req.DateTo) : new List<CompanyStatDto>();
        var dailyStats = req.IncludeDaily ? await GetDailyStatsAsync(req.DateFrom, req.DateTo) : new List<DailyStatDto>();

        // Load monitoring sessions
        List<MonitoringSession>? monitoringSessions = null;
        List<Engagement>? monitoringEngagements = null;
        if (req.IncludeMonitoringSessions)
        {
            var sessionQuery = _db.MonitoringSessions.AsQueryable();
            if (req.DateFrom.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate >= DateOnly.FromDateTime(req.DateFrom.Value));
            if (req.DateTo.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate <= DateOnly.FromDateTime(req.DateTo.Value));
            monitoringSessions = await sessionQuery.OrderBy(s => s.SessionDate).ToListAsync();
            var sids = monitoringSessions.Select(s => s.SessionID).ToList();
            monitoringEngagements = await _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post).ThenInclude(p => p!.Platform)
                .Include(e => e.Post).ThenInclude(p => p!.Company)
                .Where(e => sids.Contains(e.SessionID))
                .ToListAsync();
        }

        var dateRange = $"{req.DateFrom?.ToString("dd/MM/yyyy") ?? "All"} - {req.DateTo?.ToString("dd/MM/yyyy") ?? "All"}";
        var accentColors = new[] { "#1e40af", "#059669", "#d97706", "#7c3aed", "#dc2626" };

        using var workbook = new XLWorkbook();

        var sheetIdx = 1;

        // ── Sheet: Summary ──
        if (req.IncludeSummaryCards || req.IncludeStaffRanking)
        {
            var wsSum = workbook.Worksheets.Add("Summary & Rankings");
            wsSum.Cell(1, 1).Value = "SociHR — Custom Performance Report";
            StyleCell(wsSum.Cell(1, 1), "#ffffff", "#1e40af", true, 18, XLBorderStyleValues.None);
            wsSum.Cell(2, 1).Value = $"Period: {dateRange}";
            StyleCell(wsSum.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);
            wsSum.Cell(3, 1).Value = $"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}  •  System crafted by @syaakiirr";
            StyleCell(wsSum.Cell(3, 1), "#ffffff", "#94a3b8", false, 9, XLBorderStyleValues.None);

            if (req.IncludeSummaryCards)
            {
                var kpiHeaders = new[] { "Total Staff", "Completed", "Missed", "Expected", "Overall Rate" };
                var kpiValues = new object[] { staffPerf.Count, totalCompleted, totalMissed, totalExpected, $"{overallRate}%" };
                var kpiColors = new[] { "#6366f1", "#16a34a", "#dc2626", "#d97706", "#7c3aed" };
                for (int i = 0; i < kpiHeaders.Length; i++)
                {
                    var hc = wsSum.Cell(5, i + 1);
                    hc.Value = kpiHeaders[i];
                    StyleCell(hc, "#f1f5f9", "#475569", true, 9);
                    hc.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    var vc = wsSum.Cell(6, i + 1);
                    var kv = kpiValues[i];
                    if (kv is string s) vc.SetValue(s);
                    else if (kv is int iv) vc.SetValue(iv);
                    else vc.SetValue(kv?.ToString() ?? "");
                    StyleCell(vc, "#ffffff", kpiColors[i], true, 16);
                    vc.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                }
            }

            if (req.IncludeStaffRanking)
            {
                var rankHeaders = new[] { "Rank", "Name", "Department", "Position", "Completed", "Expected", "Rate (%)" };
                var topRow = req.IncludeSummaryCards ? 8 : 5;
                WriteSectionTitle(wsSum, topRow, 1, "Top Performing Staff (Best 10)", "#16a34a");
                WriteTableHeader(wsSum, topRow + 1, 1, rankHeaders, "#16a34a", "#ffffff");
                var top10 = staffPerf.Take(10).ToList();
                for (int i = 0; i < top10.Count; i++)
                {
                    var r = topRow + 2 + i;
                    WriteDataRow(wsSum, r, 1, new object[] { top10[i].Rank, top10[i].FullName, top10[i].Department, top10[i].Position, top10[i].Completed, top10[i].Total, $"{top10[i].CompletionRate}%" }, "#f0fdf4", "#ffffff", i % 2 == 0);
                    wsSum.Cell(r, 7).Style.Font.FontColor = Html("#16a34a");
                    wsSum.Cell(r, 7).Style.Font.Bold = true;
                }

                var botRow = topRow + 2 + Math.Max(top10.Count, 1) + 2;
                WriteSectionTitle(wsSum, botRow, 1, "Least Performing Staff (Bottom 10)", "#dc2626");
                WriteTableHeader(wsSum, botRow + 1, 1, rankHeaders, "#dc2626", "#ffffff");
                var bottom10 = staffPerf.AsEnumerable().Reverse().Take(10).Reverse().ToList();
                for (int i = 0; i < bottom10.Count; i++)
                {
                    var r = botRow + 2 + i;
                    WriteDataRow(wsSum, r, 1, new object[] { bottom10[i].Rank, bottom10[i].FullName, bottom10[i].Department, bottom10[i].Position, bottom10[i].Completed, bottom10[i].Total, $"{bottom10[i].CompletionRate}%" }, "#fef2f2", "#ffffff", i % 2 == 0);
                    wsSum.Cell(r, 7).Style.Font.FontColor = Html("#dc2626");
                    wsSum.Cell(r, 7).Style.Font.Bold = true;
                }
            }

            wsSum.Columns().AdjustToContents();
        }

        // ── Sheet: All Staff ──
        if (req.IncludeStaffTable)
        {
            var wsStaff = workbook.Worksheets.Add("All Staff Performance");
            wsStaff.Cell(1, 1).Value = "All Staff — Detailed Performance";
            StyleCell(wsStaff.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);
            wsStaff.Cell(2, 1).Value = $"Period: {dateRange}";
            StyleCell(wsStaff.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);

            var detailHeaders = new[] { "Rank", "Name", "Department", "Position", "Status", "Completed", "Missed", "Expected", "Rate (%)" };
            WriteTableHeader(wsStaff, 4, 1, detailHeaders, "#7c3aed", "#ffffff");
            for (int i = 0; i < staffPerf.Count; i++)
            {
                var r = 5 + i;
                var s = staffPerf[i];
                WriteDataRow(wsStaff, r, 1, new object[] { s.Rank, s.FullName, s.Department, s.Position, s.Status, s.Completed, s.Missed, s.Total, $"{s.CompletionRate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
                var rateColor = s.CompletionRate >= 80 ? "#16a34a" : s.CompletionRate >= 50 ? "#d97706" : "#dc2626";
                wsStaff.Cell(r, 9).Style.Font.FontColor = Html(rateColor);
                wsStaff.Cell(r, 9).Style.Font.Bold = true;
            }

            wsStaff.Columns().AdjustToContents();
        }

        // ── Sheet: Platform & Company ──
        if (req.IncludePlatformCompany)
        {
            var wsPC = workbook.Worksheets.Add("Platform & Company");
            wsPC.Cell(1, 1).Value = "Platform & Company Engagement Breakdown";
            StyleCell(wsPC.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);

            WriteSectionTitle(wsPC, 3, 1, "Engagement Ticks by Platform", "#7c3aed");
            var platHeaders = new[] { "Platform", "Completed", "Missed", "Expected", "Rate (%)" };
            WriteTableHeader(wsPC, 4, 1, platHeaders, "#7c3aed", "#ffffff");
            for (int i = 0; i < platformStats.Count; i++)
            {
                var r = 5 + i;
                var p = platformStats[i];
                WriteDataRow(wsPC, r, 1, new object[] { p.Platform, p.Completed, p.Missed, p.Total, $"{p.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
                var rateColor = p.Rate >= 80 ? "#16a34a" : p.Rate >= 50 ? "#d97706" : "#dc2626";
                wsPC.Cell(r, 5).Style.Font.FontColor = Html(rateColor);
                wsPC.Cell(r, 5).Style.Font.Bold = true;
            }

            var coTitleRow = 5 + Math.Max(platformStats.Count, 1) + 2;
            WriteSectionTitle(wsPC, coTitleRow, 1, "Engagement Ticks by Company", "#7c3aed");
            var coHeaders = new[] { "Company", "Completed", "Missed", "Expected", "Rate (%)" };
            WriteTableHeader(wsPC, coTitleRow + 1, 1, coHeaders, "#7c3aed", "#ffffff");
            for (int i = 0; i < companyStats.Count; i++)
            {
                var r = coTitleRow + 2 + i;
                var c = companyStats[i];
                WriteDataRow(wsPC, r, 1, new object[] { c.Company, c.Completed, c.Missed, c.Total, $"{c.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
                var rateColor = c.Rate >= 80 ? "#16a34a" : c.Rate >= 50 ? "#d97706" : "#dc2626";
                wsPC.Cell(r, 5).Style.Font.FontColor = Html(rateColor);
                wsPC.Cell(r, 5).Style.Font.Bold = true;
            }

            wsPC.Columns().AdjustToContents();
        }

        // ── Sheet: Daily ──
        if (req.IncludeDaily)
        {
            var wsDaily = workbook.Worksheets.Add("Daily Engagement");
            wsDaily.Cell(1, 1).Value = "Daily Engagement Breakdown";
            StyleCell(wsDaily.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);

            var dailyHeaders = new[] { "Date", "Sessions", "Completed", "Missed", "Expected", "Rate (%)" };
            WriteTableHeader(wsDaily, 3, 1, dailyHeaders, "#7c3aed", "#ffffff");
            if (dailyStats.Count == 0)
            {
                wsDaily.Cell(4, 1).Value = "No sessions found in this date range.";
                StyleCell(wsDaily.Cell(4, 1), "#ffffff", "#94a3b8", true, 10, XLBorderStyleValues.None);
            }
            else
            {
                for (int i = 0; i < dailyStats.Count; i++)
                {
                    var r = 4 + i;
                    var d = dailyStats[i];
                    WriteDataRow(wsDaily, r, 1, new object[] { d.Date.ToString("dd/MM/yyyy"), d.SessionCount, d.Completed, d.Missed, d.Total, d.Rate / 100.0 }, "#f8fafc", "#ffffff", i % 2 == 0);
                    wsDaily.Cell(r, 3).Style.Font.FontColor = Html("#16a34a");
                    wsDaily.Cell(r, 4).Style.Font.FontColor = Html("#dc2626");
                    wsDaily.Cell(r, 6).Style.NumberFormat.Format = "0.0%";
                    wsDaily.Cell(r, 6).Style.Font.Bold = true;
                }

                var rateRange = wsDaily.Range(4, 6, 3 + dailyStats.Count, 6);
                rateRange.AddConditionalFormat().ColorScale()
                    .LowestValue(Html("#eef2ff"))
                    .Midpoint(XLCFContentType.Percent, "50", Html("#a5b4fc"))
                    .HighestValue(Html("#6366f1"));
            }

            wsDaily.Columns().AdjustToContents();
        }

        // ── Sheets: Monitoring Sessions ──
        if (req.IncludeMonitoringSessions && monitoringSessions != null && monitoringEngagements != null)
        {
            for (int sIdx = 0; sIdx < monitoringSessions.Count; sIdx++)
            {
                var session = monitoringSessions[sIdx];
                var sessionEngs = monitoringEngagements.Where(e => e.SessionID == session.SessionID).ToList();
                var rd = MonitoringSessionController.BuildReportData(session, sessionEngs);
                var accent = accentColors[sIdx % accentColors.Length];
                var sheetName = $"Session {sIdx + 1} - {session.SessionDate:yyyy-MM-dd}";
                if (sheetName.Length > 31) sheetName = sheetName[..31];

                var ws = workbook.Worksheets.Add(sheetName);

                ws.Cell(1, 1).Value = $"Monitoring Session — {session.SessionDate:dd MMMM yyyy}";
                StyleCell(ws.Cell(1, 1), accent, "#ffffff", true, 14, XLBorderStyleValues.None);
                ws.Range(1, 1, 1, 8).Merge();
                ws.Cell(2, 1).Value = $"Session {sIdx + 1} of {monitoringSessions.Count}";
                StyleCell(ws.Cell(2, 1), "#ffffff", "#64748b", false, 10, XLBorderStyleValues.None);

                var scRow = 4;
                var summaryCards = new[] {
                    ("Total Likes", rd.TotalLikes.ToString(), "#3b82f6"),
                    ("Total Comments", rd.TotalComments.ToString(), "#0ea5e9"),
                    ("Total Shares", rd.TotalShares.ToString(), "#10b981")
                };
                for (int ci = 0; ci < summaryCards.Length; ci++)
                {
                    var (label, val, color) = summaryCards[ci];
                    var c = ws.Cell(scRow, ci * 2 + 1);
                    c.Value = label;
                    StyleCell(c, "#f8fafc", color, true, 10);
                    c.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    var vc = ws.Cell(scRow + 1, ci * 2 + 1);
                    vc.Value = int.TryParse(val, out var n) ? n : val;
                    StyleCell(vc, "#ffffff", color, true, 18);
                    vc.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                }

                int tblRow = scRow + 3;
                int cCol = 1;

                ws.Cell(tblRow, cCol).Value = "#";
                StyleCell(ws.Cell(tblRow, cCol), "#f1f5f9", "#475569", true, 8);
                ws.Range(tblRow, cCol, tblRow + 2, cCol).Merge();
                cCol++;

                ws.Cell(tblRow, cCol).Value = req.IncludeStaffPosition ? "Staff Name" : "Staff Name";
                StyleCell(ws.Cell(tblRow, cCol), "#f1f5f9", "#475569", true, 8);
                ws.Range(tblRow, cCol, tblRow + 2, cCol).Merge();
                cCol++;

                ws.Cell(tblRow, cCol).Value = req.IncludeStaffPosition ? "Position" : "Dept";
                StyleCell(ws.Cell(tblRow, cCol), "#f1f5f9", "#475569", true, 8);
                ws.Range(tblRow, cCol, tblRow + 2, cCol).Merge();
                cCol++;

                int actStart = cCol;
                foreach (var coGroup in rd.CompanyGroups)
                {
                    var cell = ws.Cell(tblRow, cCol);
                    cell.Value = coGroup.Name;
                    StyleCell(cell, "#dbeafe", "#1e40af", true, 10);
                    cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    if (coGroup.Span > 1)
                        ws.Range(tblRow, cCol, tblRow, cCol + coGroup.Span - 1).Merge();
                    cCol += coGroup.Span;
                }

                int rsnCol = cCol;
                if (req.IncludeReasonColumn)
                {
                    ws.Cell(tblRow, rsnCol).Value = "Reason";
                    StyleCell(ws.Cell(tblRow, rsnCol), "#fef3c7", "#92400e", true, 9);
                    ws.Range(tblRow, rsnCol, tblRow + 2, rsnCol).Merge();
                }

                cCol = actStart;
                foreach (var platGroup in rd.PlatformGroups)
                {
                    var cell = ws.Cell(tblRow + 1, cCol);
                    cell.Value = platGroup.PlatformName;
                    StyleCell(cell, "#e0f2fe", "#0369a1", true, 9);
                    cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    if (platGroup.Span > 1)
                        ws.Range(tblRow + 1, cCol, tblRow + 1, cCol + platGroup.Span - 1).Merge();
                    cCol += platGroup.Span;
                }

                cCol = actStart;
                foreach (var ac in rd.ActionColumns)
                {
                    var cell = ws.Cell(tblRow + 2, cCol);
                    cell.Value = ac.ActionLabel;
                    StyleCell(cell, "#f0fdf4", "#15803d", true, 8);
                    cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    cCol++;
                }

                int dRow = tblRow + 3;
                for (int ri = 0; ri < rd.StaffRows.Count; ri++)
                {
                    var staffRow = rd.StaffRows[ri];
                    var bg = ri % 2 == 0 ? "#ffffff" : "#f8fafc";

                    int dc = 1;
                    ws.Cell(dRow, dc).Value = ri + 1;
                    StyleCell(ws.Cell(dRow, dc), bg, "#64748b", false, 8);
                    ws.Cell(dRow, dc).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    dc++;

                    ws.Cell(dRow, dc).Value = staffRow.StaffName;
                    StyleCell(ws.Cell(dRow, dc), bg, "#1e293b", true, 8);
                    dc++;

                    ws.Cell(dRow, dc).Value = staffRow.Department;
                    StyleCell(ws.Cell(dRow, dc), bg, "#475569", false, 8);
                    dc++;

                    for (int ei = 0; ei < staffRow.EngagementValues.Count; ei++)
                    {
                        if (staffRow.EngagementValues[ei])
                        {
                            ws.Cell(dRow, dc).Value = "✓";
                            ws.Cell(dRow, dc).Style.Font.FontColor = Html("#ffffff");
                            ws.Cell(dRow, dc).Style.Fill.BackgroundColor = Html("#10b981");
                            ws.Cell(dRow, dc).Style.Font.Bold = true;
                        }
                        else
                        {
                            ws.Cell(dRow, dc).Value = "";
                            ws.Cell(dRow, dc).Style.Fill.BackgroundColor = Html(bg);
                        }
                        ws.Cell(dRow, dc).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                        ws.Cell(dRow, dc).Style.Border.SetLeftBorder(XLBorderStyleValues.Thin).Border.SetLeftBorderColor(Html("#cbd5e1"));
                        ws.Cell(dRow, dc).Style.Border.SetRightBorder(XLBorderStyleValues.Thin).Border.SetRightBorderColor(Html("#cbd5e1"));
                        ws.Cell(dRow, dc).Style.Border.SetTopBorder(XLBorderStyleValues.Thin).Border.SetTopBorderColor(Html("#cbd5e1"));
                        ws.Cell(dRow, dc).Style.Border.SetBottomBorder(XLBorderStyleValues.Thin).Border.SetBottomBorderColor(Html("#cbd5e1"));
                        dc++;
                    }

                    if (req.IncludeReasonColumn)
                    {
                        ws.Cell(dRow, rsnCol).Value = staffRow.Reason ?? "";
                        StyleCell(ws.Cell(dRow, rsnCol), bg, "#475569", false, 7);
                    }
                    dRow++;
                }

                var ftrRow = dRow + 2;
                ws.Cell(ftrRow, 1).Value = "@syaakiirr";
                StyleCell(ws.Cell(ftrRow, 1), "#ffffff", "#94a3b8", false, 7, XLBorderStyleValues.None);
                ws.Cell(ftrRow + 1, 1).Value = $"Generated {DateTime.UtcNow:dd MMMM yyyy HH:mm:ss} UTC";
                StyleCell(ws.Cell(ftrRow + 1, 1), "#ffffff", "#9ca3af", false, 8, XLBorderStyleValues.None);

                ws.Columns().AdjustToContents();
            }
        }

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Seek(0, SeekOrigin.Begin);

        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"SociHR_Custom_Report_{DateTime.Now:yyyyMMdd}.xlsx");
    }

    // GET /api/reports/pdf?from=2026-01-01&to=2026-12-31
    [HttpGet("pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool showCards = true,
        [FromQuery] bool showRanking = true,
        [FromQuery] bool showPlatformCompany = true,
        [FromQuery] bool showDaily = true,
        [FromQuery] bool showStaffTable = true,
        [FromQuery] bool showMonitoringSessions = true)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var staffList = await _db.Staff
            .Where(s => !s.IsArchived)
            .ToDictionaryAsync(s => s.StaffID);

        var ranking = await StaffRankingHelper.GetRanking(_db, "top", null, from, to);

        var staffPerf = ranking.Select((d, idx) =>
        {
            var staff = staffList.TryGetValue(d.StaffID, out var s) ? s : null;
            var missed = d.Total - d.Completed;
            return new StaffPerformanceDto
            {
                Rank = idx + 1,
                StaffID = d.StaffID,
                FullName = d.FullName,
                Department = d.Department ?? "-",
                Position = staff?.Position ?? "-",
                Status = staff?.Status ?? "Active",
                Completed = d.Completed,
                Missed = missed,
                Total = d.Total,
                CompletionRate = d.CompletionRate
            };
        }).ToList();

        var totalCompleted = staffPerf.Sum(s => s.Completed);
        var totalMissed = staffPerf.Sum(s => s.Missed);
        var totalExpected = totalCompleted + totalMissed;
        var overallRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100) : 0;

        var platformStats = await GetPlatformStatsAsync(from, to);
        var companyStats = await GetCompanyStatsAsync(from, to);
        var dailyStats = await GetDailyStatsAsync(from, to);

        // Pre-load sessions & engagements for the monitoring table section
        List<MonitoringSession>? monitoringSessions = null;
        List<Engagement>? monitoringEngagements = null;
        if (showMonitoringSessions)
        {
            var sessionQuery = _db.MonitoringSessions.AsQueryable();
            if (from.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate >= DateOnly.FromDateTime(from.Value));
            if (to.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate <= DateOnly.FromDateTime(to.Value));
            monitoringSessions = await sessionQuery.OrderBy(s => s.SessionDate).ToListAsync();
            var sids = monitoringSessions.Select(s => s.SessionID).ToList();
            monitoringEngagements = await _db.Engagements
                .Include(e => e.Post).ThenInclude(p => p!.Platform)
                .Include(e => e.Post).ThenInclude(p => p!.Company)
                .Include(e => e.Staff)
                .Where(e => sids.Any(id => id == e.SessionID))
                .ToListAsync();
        }

        var dateRange = $"{from?.ToString("dd/MM/yyyy") ?? "All"} - {to?.ToString("dd/MM/yyyy") ?? "All"}";

        var top10 = staffPerf.Take(10).ToList();
        var bottom10 = staffPerf.AsEnumerable().Reverse().Take(10).Reverse().ToList();

        var pdf = Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(30);
                page.DefaultTextStyle(t => t.FontSize(9));

                page.Header().Element(header =>
                {
                    header.Row(r =>
                    {
                        r.RelativeItem().Column(c =>
                        {
                            c.Item().Text("SociHR — Performance & Engagement Report").FontSize(18).Bold().FontColor("#7c3aed");
                            c.Item().Text($"Period: {dateRange}  •  System crafted by @syaakiirr").FontSize(10).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}").FontSize(9).FontColor(Colors.Grey.Medium);
                        });
                        r.ConstantItem(250).Column(c =>
                        {
                            c.Item().Text($"Total Active Staff: {staffPerf.Count}").FontSize(10);
                            c.Item().Text($"Total Completed Ticks: {totalCompleted}").FontSize(10).FontColor(Colors.Green.Medium);
                            c.Item().Text($"Total Missed Ticks: {totalMissed}").FontSize(10).FontColor(Colors.Red.Medium);
                            c.Item().Text($"Overall Completion Rate: {overallRate}%").FontSize(11).Bold().FontColor("#7c3aed");
                        });
                    });
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    // Mini summary cards
                    if (showCards)
                        col.Item().PaddingBottom(15).Row(row =>
                        {
                            row.RelativeItem().Element(c => Card(c, "Total Staff", staffPerf.Count.ToString(), Colors.Blue.Medium));
                            row.ConstantItem(12);
                            row.RelativeItem().Element(c => Card(c, "Completed Ticks", totalCompleted.ToString(), Colors.Green.Medium));
                            row.ConstantItem(12);
                            row.RelativeItem().Element(c => Card(c, "Missed Ticks", totalMissed.ToString(), Colors.Red.Medium));
                            row.ConstantItem(12);
                            row.RelativeItem().Element(c => Card(c, "Overall Rate", $"{overallRate}%", "#7c3aed"));
                        });
                    else if (showRanking || showPlatformCompany || showDaily || showStaffTable)
                        col.Item().PaddingBottom(15);

                    // Top 10 & Bottom 10 side-by-side
                    if (showRanking)
                        col.Item().PaddingBottom(20).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Top Performing Staff (Best 10)").FontSize(11).Bold().FontColor(Colors.Green.Darken2);
                                c.Item().PaddingTop(4).Element(t => MiniTable(t, top10, true));
                            });
                            
                            row.ConstantItem(20);
                            
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Least Performing Staff (Bottom 10)").FontSize(11).Bold().FontColor(Colors.Red.Darken2);
                                c.Item().PaddingTop(4).Element(t => MiniTable(t, bottom10, false));
                            });
                        });

                    if (showPlatformCompany)
                    {
                        col.Item().PageBreak();

                        col.Item().Column(c =>
                        {
                            c.Item().PaddingBottom(6).Text("Engagement Ticks by Platform").FontSize(12).Bold().FontColor("#7c3aed");
                            c.Item().PaddingBottom(20).Element(t => PlatformTable(t, platformStats));

                            c.Item().PaddingBottom(6).Text("Engagement Ticks by Company").FontSize(12).Bold().FontColor("#7c3aed");
                            c.Item().Element(t => CompanyTable(t, companyStats));
                        });
                    }

                    if (showDaily)
                    {
                        col.Item().PageBreak();

                        col.Item().Column(c =>
                        {
                            c.Item().PaddingBottom(6).Text("Daily Engagement Breakdown").FontSize(12).Bold().FontColor("#7c3aed");
                            if (dailyStats.Count == 0)
                                c.Item().Text("No sessions found in this date range.").FontColor(Colors.Grey.Medium);
                            else
                                c.Item().Element(t => DailyTable(t, dailyStats));
                        });
                    }

                    if (showStaffTable)
                    {
                        col.Item().PageBreak();

                        col.Item().Column(c =>
                        {
                            c.Item().PaddingBottom(6).Text("All Staff Performance Details").FontSize(12).Bold();
                            c.Item().Table(table =>
                            {
                                table.ColumnsDefinition(cd =>
                                {
                                    cd.ConstantColumn(40);
                                    cd.RelativeColumn(3);
                                    cd.RelativeColumn(2);
                                    cd.RelativeColumn(2);
                                    cd.ConstantColumn(70);
                                    cd.ConstantColumn(70);
                                    cd.ConstantColumn(60);
                                });

                                static IContainer HeaderCell(IContainer container) => 
                                    container.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background("#7c3aed").Padding(5);

                                table.Header(h =>
                                {
                                    h.Cell().Element(HeaderCell).Text("Rank");
                                    h.Cell().Element(HeaderCell).Text("Name");
                                    h.Cell().Element(HeaderCell).Text("Department");
                                    h.Cell().Element(HeaderCell).Text("Position");
                                    h.Cell().Element(HeaderCell).Text("Completed");
                                    h.Cell().Element(HeaderCell).Text("Expected");
                                    h.Cell().Element(HeaderCell).Text("Rate");
                                });

                                bool alternate = false;
                                for (int i = 0; i < staffPerf.Count; i++)
                                {
                                    var s = staffPerf[i];
                                    var bgColor = alternate ? Colors.Grey.Lighten5 : Colors.White;
                                    alternate = !alternate;

                                    static IContainer DataCell(IContainer container, string color) =>
                                        container.Background(color).BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4);

                                    table.Cell().Element(ct => DataCell(ct, bgColor)).Text(s.Rank.ToString());
                                    table.Cell().Element(ct => DataCell(ct, bgColor)).Text(s.FullName).Bold();
                                    table.Cell().Element(ct => DataCell(ct, bgColor)).Text(s.Department);
                                    table.Cell().Element(ct => DataCell(ct, bgColor)).Text(s.Position);
                                    table.Cell().Element(ct => DataCell(ct, bgColor)).Text(s.Completed.ToString());
                                    table.Cell().Element(ct => DataCell(ct, bgColor)).Text(s.Total.ToString());
                                    
                                    var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1 
                                                : s.CompletionRate >= 50 ? Colors.Orange.Darken2 
                                                : Colors.Red.Darken1;
                                                    
                                    table.Cell().Element(ct => DataCell(ct, bgColor)).Text($"{s.CompletionRate}%").FontColor(rateColor).Bold();
                                }
                            });
                        });
                    }
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("SociHR Performance & Engagement Report  •  Page ").FontColor(Colors.Grey.Medium);
                    t.CurrentPageNumber().FontColor(Colors.Grey.Medium);
                    t.Span(" of ").FontColor(Colors.Grey.Medium);
                    t.TotalPages().FontColor(Colors.Grey.Medium);
                });
            });

            // Monitoring session pages (A3 Landscape, one per session)
            if (showMonitoringSessions && monitoringSessions != null && monitoringEngagements != null && monitoringSessions.Count > 0)
            {
                var accentColors = new[] { "#1e40af", "#059669", "#d97706", "#7c3aed", "#dc2626" };
                for (int sIdx = 0; sIdx < monitoringSessions.Count; sIdx++)
                {
                    var session = monitoringSessions[sIdx];
                    var engs = monitoringEngagements.Where(e => e.SessionID == session.SessionID).ToList();
                    var rd = MonitoringSessionController.BuildReportData(session, engs);
                    var accent = accentColors[sIdx % accentColors.Length];
                    var sessionIdx = sIdx;

                    doc.Page(page =>
                    {
                        page.Size(PageSizes.A3.Landscape());
                        page.Margin(16);

                        page.Header().Column(h =>
                        {
                            h.Item().Background(accent).Padding(6).Row(row =>
                            {
                                row.RelativeItem().Text($"SESSION {sessionIdx + 1} OF {monitoringSessions.Count}")
                                    .FontSize(11).Bold().FontColor("#ffffff");
                                row.RelativeItem().AlignRight().Text($"{session.SessionDate:dd MMMM yyyy}")
                                    .FontSize(11).Bold().FontColor("#ffffff");
                            });
                            h.Item().PaddingTop(4).Row(row =>
                            {
                                row.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Custom Report — Monitoring Session").FontSize(14).Bold().FontColor("#1e40af");
                                    c.Item().Text($"Period: {dateRange}").FontSize(8).FontColor("#9ca3af");
                                });
                            });
                        });

                        page.Content().Column(col =>
                        {
                            // Summary cards
                            col.Item().PaddingBottom(12).Row(row =>
                            {
                                row.RelativeItem().Element(c => Card(c, "Total Likes", rd.TotalLikes.ToString(), "#3b82f6"));
                                row.ConstantItem(12);
                                row.RelativeItem().Element(c => Card(c, "Total Comments", rd.TotalComments.ToString(), "#0ea5e9"));
                                row.ConstantItem(12);
                                row.RelativeItem().Element(c => Card(c, "Total Shares", rd.TotalShares.ToString(), "#10b981"));
                            });

                            // Full monitoring table
                            col.Item().Element(c => RenderMonitoringTable(c, rd));
                        });

                        page.Footer().Column(f =>
                        {
                            f.Item().AlignCenter().Text("@syaakiirr").FontSize(7).FontColor("#94a3b8");
                            f.Item().AlignCenter().Text(t =>
                            {
                                t.Span("Generated ").FontSize(8).FontColor("#9ca3af");
                                t.Span($"{DateTime.UtcNow:dd MMMM yyyy HH:mm:ss} UTC").FontSize(8).FontColor("#9ca3af");
                                t.Span("  •  Report Page ").FontSize(8).FontColor("#9ca3af");
                                t.CurrentPageNumber().FontSize(8).FontColor("#9ca3af");
                                t.Span(" of ").FontSize(8).FontColor("#9ca3af");
                                t.TotalPages().FontSize(8).FontColor("#9ca3af");
                            });
                        });
                    });
                }
            }
        });

        var bytes = pdf.GeneratePdf();
        return File(bytes, "application/pdf", $"SociHR_Performance_Report_{DateTime.Now:yyyyMMdd}.pdf");
    }

    private void Card(IContainer container, string label, string value, string color)
    {
        container
            .Background(Colors.Grey.Lighten4)
            .Border(1)
            .BorderColor(Colors.Grey.Lighten2)
            .Row(row =>
            {
                row.ConstantItem(4).Background(color);
                
                row.RelativeItem().Padding(8).Column(c =>
                {
                    c.Item().Text(label).FontSize(8).FontColor(Colors.Grey.Medium).Bold();
                    c.Item().Text(value).FontSize(14).Bold().FontColor(color);
                });
            });
    }

    private void MiniTable(IContainer container, List<StaffPerformanceDto> items, bool isTop)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(30); // Rank
                cd.RelativeColumn(3);  // Name
                cd.RelativeColumn(2);  // Dept
                cd.ConstantColumn(50); // Rate
            });

            var headerColor = isTop ? Colors.Green.Darken1 : Colors.Red.Darken1;

            static IContainer HeaderCell(IContainer c, string color) => 
                c.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background(color).Padding(4);

            table.Header(h =>
            {
                h.Cell().Element(c => HeaderCell(c, headerColor)).Text("Rank");
                h.Cell().Element(c => HeaderCell(c, headerColor)).Text("Name");
                h.Cell().Element(c => HeaderCell(c, headerColor)).Text("Dept");
                h.Cell().Element(c => HeaderCell(c, headerColor)).Text("Rate");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var s = items[i];
                var bgColor = i % 2 == 1 ? Colors.Grey.Lighten5 : Colors.White;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4);

                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Rank.ToString());
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.FullName).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Department);
                table.Cell().Element(c => DataCell(c, bgColor)).Text($"{s.CompletionRate}%").FontColor(headerColor).Bold();
            }
        });
    }

    private void PlatformTable(IContainer container, List<PlatformStatDto> items)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3);  // Platform
                cd.ConstantColumn(90); // Completed
                cd.ConstantColumn(90); // Missed
                cd.ConstantColumn(90); // Expected
                cd.ConstantColumn(70); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background("#7c3aed").Padding(5);

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("Platform");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Missed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var p = items[i];
                var bgColor = i % 2 == 1 ? Colors.Grey.Lighten5 : Colors.White;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(5);

                var rateColor = p.Rate >= 80 ? Colors.Green.Darken1 : p.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                table.Cell().Element(c => DataCell(c, bgColor)).Text(p.Platform).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).Text(p.Completed.ToString()).FontColor(Colors.Green.Medium);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(p.Missed.ToString()).FontColor(Colors.Red.Medium);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(p.Total.ToString());
                table.Cell().Element(c => DataCell(c, bgColor)).Text($"{p.Rate}%").FontColor(rateColor).Bold();
            }
        });
    }

    private void CompanyTable(IContainer container, List<CompanyStatDto> items)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3);  // Company
                cd.ConstantColumn(90); // Completed
                cd.ConstantColumn(90); // Missed
                cd.ConstantColumn(90); // Expected
                cd.ConstantColumn(70); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background("#7c3aed").Padding(5);

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("Company");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Missed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var co = items[i];
                var bgColor = i % 2 == 1 ? Colors.Grey.Lighten5 : Colors.White;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(5);

                var rateColor = co.Rate >= 80 ? Colors.Green.Darken1 : co.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                table.Cell().Element(c => DataCell(c, bgColor)).Text(co.Company).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).Text(co.Completed.ToString()).FontColor(Colors.Green.Medium);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(co.Missed.ToString()).FontColor(Colors.Red.Medium);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(co.Total.ToString());
                table.Cell().Element(c => DataCell(c, bgColor)).Text($"{co.Rate}%").FontColor(rateColor).Bold();
            }
        });
    }

    private void DailyTable(IContainer container, List<DailyStatDto> items)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(2);  // Date
                cd.ConstantColumn(70);  // Sessions
                cd.ConstantColumn(90); // Completed
                cd.ConstantColumn(90); // Missed
                cd.ConstantColumn(90); // Expected
                cd.ConstantColumn(70); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background("#7c3aed").Padding(5);

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("Date");
                h.Cell().Element(HeaderCell).Text("Sessions");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Missed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var d = items[i];
                var bgColor = i % 2 == 1 ? Colors.Grey.Lighten5 : Colors.White;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(5);

                table.Cell().Element(c => DataCell(c, bgColor)).Text(d.Date.ToString("dd/MM/yyyy")).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).Text(d.SessionCount.ToString());
                table.Cell().Element(c => DataCell(c, bgColor)).Text(d.Completed.ToString()).FontColor(Colors.Green.Medium);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(d.Missed.ToString()).FontColor(Colors.Red.Medium);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(d.Total.ToString());

                // Heatmap-style tinted cell for Rate, same colour language as the dashboard calendar
                var heatBg = RateHeatColor(d.Rate);
                var heatText = d.Rate >= 60 ? "#ffffff" : "#4338ca";
                table.Cell().Element(c => DataCell(c, heatBg)).AlignCenter().Text($"{d.Rate}%").FontColor(heatText).Bold();
            }
        });
    }

    /// <summary>Interpolates a heatmap color (light lavender → indigo) for a 0-100 rate, matching the dashboard.</summary>
    private static string RateHeatColor(double rate)
    {
        var t = Math.Clamp(rate / 100.0, 0, 1);
        // #eef2ff -> #6366f1
        int r1 = 0xee, g1 = 0xf2, b1 = 0xff;
        int r2 = 0x63, g2 = 0x66, b2 = 0xf1;
        int r = (int)(r1 + (r2 - r1) * t);
        int g = (int)(g1 + (g2 - g1) * t);
        int b = (int)(b1 + (b2 - b1) * t);
        return $"#{r:X2}{g:X2}{b:X2}";
    }

    // ─── Data helpers shared by Excel & PDF exports ─────────────────

    private async Task<List<PlatformStatDto>> GetPlatformStatsAsync(DateTime? from, DateTime? to)
    {
        var query = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Session)
            .AsQueryable();

        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            query = query.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            query = query.Where(e => e.Session!.SessionDate <= toDate);
        }

        var engagements = await query.ToListAsync();

        return engagements
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g =>
            {
                var completed = g.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
                var total = g.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
                var missed = total - completed;
                return new PlatformStatDto
                {
                    Platform = g.Key,
                    Completed = completed,
                    Missed = missed,
                    Total = total,
                    Rate = total > 0 ? Math.Round((double)completed / total * 100) : 0
                };
            })
            .OrderByDescending(p => p.Total)
            .ToList();
    }

    private async Task<List<CompanyStatDto>> GetCompanyStatsAsync(DateTime? from, DateTime? to)
    {
        var companies = await _db.Companies
            .OrderBy(c => c.CompanyName)
            .ToListAsync();

        var query = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Session)
            .Where(e => e.Post!.CompanyID != null)
            .AsQueryable();

        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            query = query.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            query = query.Where(e => e.Session!.SessionDate <= toDate);
        }

        var engagements = await query.ToListAsync();

        return companies.Select(company =>
        {
            var companyEngagements = engagements.Where(e => e.Post!.CompanyID == company.CompanyID).ToList();
            var completed = companyEngagements.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
            var total = companyEngagements.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
            var missed = total - completed;
            return new CompanyStatDto
            {
                Company = company.CompanyName,
                Completed = completed,
                Missed = missed,
                Total = total,
                Rate = total > 0 ? Math.Round((double)completed / total * 100) : 0
            };
        }).ToList();
    }

    private async Task<List<DailyStatDto>> GetDailyStatsAsync(DateTime? from, DateTime? to)
    {
        var sessionQuery = _db.MonitoringSessions.AsQueryable();

        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            sessionQuery = sessionQuery.Where(s => s.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            sessionQuery = sessionQuery.Where(s => s.SessionDate <= toDate);
        }

        var sessions = await sessionQuery.OrderBy(s => s.SessionDate).ToListAsync();
        var sessionIds = sessions.Select(s => s.SessionID).ToList();

        var engagements = await _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => sessionIds.Contains(e.SessionID))
            .ToListAsync();

        return sessions
            .GroupBy(s => s.SessionDate)
            .Select(g =>
            {
                var sIds = g.Select(s => s.SessionID).ToList();
                var eng = engagements.Where(e => sIds.Contains(e.SessionID)).ToList();
                var completed = eng.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
                var total = eng.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
                var missed = total - completed;
                return new DailyStatDto
                {
                    Date = g.Key,
                    SessionCount = g.Count(),
                    Completed = completed,
                    Missed = missed,
                    Total = total,
                    Rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0
                };
            })
            .OrderBy(d => d.Date)
            .ToList();
    }

    private void RenderMonitoringTable(IContainer container, MonitoringSessionController.ReportData rd)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(18);
                columns.ConstantColumn(115);
                columns.ConstantColumn(65);
                foreach (var _ in rd.ActionColumns)
                    columns.RelativeColumn();
                columns.ConstantColumn(50);
            });

            table.Header(header =>
            {
                static IContainer BaseHeader(IContainer c, string bg) =>
                    c.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignCenter().AlignMiddle();

                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("#").FontSize(7.5f).Bold().FontColor("#475569");
                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Staff Name").FontSize(7.5f).Bold().FontColor("#475569");
                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Dept").FontSize(7.5f).Bold().FontColor("#475569");

                foreach (var coGroup in rd.CompanyGroups)
                {
                    header.Cell().ColumnSpan((uint)coGroup.Span).Element(c => BaseHeader(c, "#dbeafe"))
                        .Text(t => t.Span(coGroup.Name).FontSize(9f).Bold().FontColor("#1e40af"));
                }

                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#fef3c7")).Text("Reason").FontSize(7.5f).Bold().FontColor("#92400e");

                foreach (var platGroup in rd.PlatformGroups)
                {
                    var cell = header.Cell().ColumnSpan((uint)platGroup.Span).Element(c => BaseHeader(c, "#e0f2fe"));
                    if (!string.IsNullOrEmpty(platGroup.PostLink))
                        cell.Hyperlink(platGroup.PostLink).Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1").Underline());
                    else
                        cell.Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1"));
                }

                foreach (var ac in rd.ActionColumns)
                {
                    header.Cell().Element(c => BaseHeader(c, "#f0fdf4"))
                        .Text(t => t.Span(ac.ActionLabel).FontSize(6.5f).Bold().FontColor("#15803d"));
                }
            });

            int rowNum = 1;
            foreach (var staffRow in rd.StaffRows)
            {
                var bgColor = rowNum % 2 == 0 ? "#f8fafc" : "#ffffff";

                static IContainer DataCell(IContainer c, string bg) =>
                    c.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignMiddle();

                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(rowNum.ToString()).FontSize(7).FontColor("#64748b");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.StaffName).FontSize(7).Bold().FontColor("#1e293b"));
                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Department).FontSize(7).FontColor("#475569"));

                static IContainer ActionCell(IContainer c, string bg) =>
                    c.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(2).AlignMiddle();

                for (int i = 0; i < staffRow.EngagementValues.Count; i++)
                {
                    var value = staffRow.EngagementValues[i];
                    var cell = table.Cell().Element(c => ActionCell(c, bgColor)).AlignCenter();
                    if (value)
                    {
                        cell.AlignCenter().AlignMiddle()
                            .Padding(1).Background("#10b981").Border(1).BorderColor("#059669")
                            .AlignCenter().AlignMiddle().Padding(1)
                            .Text("v").FontSize(6).Bold().FontColor("#ffffff");
                    }
                    else
                    {
                        cell.Text("");
                    }
                }

                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Reason ?? "").FontSize(6).FontColor("#475569"));
                rowNum++;
            }
        });
    }
}

public class StaffPerformanceDto
{
    public int Rank { get; set; }
    public Guid StaffID { get; set; }
    public string FullName { get; set; } = "";
    public string Department { get; set; } = "-";
    public string Position { get; set; } = "-";
    public string Status { get; set; } = "Active";
    public int Completed { get; set; }
    public int Missed { get; set; }
    public int Total { get; set; }
    public double CompletionRate { get; set; }
}

public class PlatformStatDto
{
    public string Platform { get; set; } = "";
    public int Completed { get; set; }
    public int Missed { get; set; }
    public int Total { get; set; }
    public double Rate { get; set; }
}

public class CompanyStatDto
{
    public string Company { get; set; } = "";
    public int Completed { get; set; }
    public int Missed { get; set; }
    public int Total { get; set; }
    public double Rate { get; set; }
}

public class DailyStatDto
{
    public DateOnly Date { get; set; }
    public int SessionCount { get; set; }
    public int Completed { get; set; }
    public int Missed { get; set; }
    public int Total { get; set; }
    public double Rate { get; set; }
}

public record CustomExcelReportRequest(
    DateTime? DateFrom,
    DateTime? DateTo,
    bool IncludeSummaryCards = true,
    bool IncludeStaffRanking = true,
    bool IncludePlatformCompany = true,
    bool IncludeDaily = true,
    bool IncludeStaffTable = true,
    bool IncludeMonitoringSessions = true,
    bool IncludeReasonColumn = true,
    bool IncludeStaffPosition = true
);
