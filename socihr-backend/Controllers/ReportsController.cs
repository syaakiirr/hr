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

    // Helper: get DepartmentID for DeptAdmin, null for SuperAdmin
    private Guid? GetDeptIdRestriction()
    {
        if (User.IsInRole("DeptAdmin"))
        {
            var claim = User.FindFirst("DepartmentID")?.Value;
            return claim != null ? Guid.Parse(claim) : null;
        }
        return null;
    }

    private async Task<string?> GetDeptNameRestrictionAsync()
    {
        var deptId = GetDeptIdRestriction();
        if (!deptId.HasValue) return null;
        return await _db.Departments
            .Where(d => d.DepartmentID == deptId)
            .Select(d => d.DepartmentName)
            .FirstOrDefaultAsync();
    }

    // Helper: resolve effective department filter list
    // For DeptAdmin: always restricted to their own dept (single name)
    // For SuperAdmin: use provided departments list (null/empty = all departments)
    private async Task<List<string>?> GetEffectiveDeptFilterAsync(string? departmentsParam)
    {
        var deptName = await GetDeptNameRestrictionAsync();
        if (deptName != null)
        {
            // DeptAdmin — always restricted to their own dept only
            return new List<string> { deptName };
        }
        // SuperAdmin — use provided filter if any
        if (!string.IsNullOrWhiteSpace(departmentsParam))
        {
            var list = departmentsParam
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(d => !string.IsNullOrWhiteSpace(d))
                .ToList();
            if (list.Count > 0) return list;
        }
        return null; // null = no filter = all departments
    }

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

    // GET /api/reports/excel?from=2026-01-01&to=2026-12-31&departments=HR,Ageing
    [HttpGet("excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? departments = null)
    {
        var deptFilter = await GetEffectiveDeptFilterAsync(departments);
        var deptName = deptFilter?.Count == 1 ? deptFilter[0] : null; // legacy single-dept compat

        var staffQuery = _db.Staff.Where(s => !s.IsArchived);
        if (deptFilter != null) staffQuery = staffQuery.Where(s => deptFilter.Contains(s.Department));
        var staffList = await staffQuery.ToDictionaryAsync(s => s.StaffID);

        var ranking = await StaffRankingHelper.GetRankingMultiDept(_db, "top", null, from, to, deptFilter);

        var staffPerf = ranking.Select((d, idx) =>
        {
            var staff = staffList.TryGetValue(d.StaffID, out var s) ? s : null;
            var missed = d.Total - d.Completed;
            return new StaffPerformanceDto
            {
                Rank = idx + 1,
                StaffID = d.StaffID,
                FullName = d.FullName,
                Department = string.IsNullOrWhiteSpace(d.Department) || d.Department == "-" ? "No Department" : d.Department,
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

        var deptStatsList = BuildDepartmentStats(staffPerf);
        var platformStats = await GetPlatformStatsMultiDeptAsync(from, to, deptFilter);
        var companyStats = await GetCompanyStatsMultiDeptAsync(from, to, deptFilter);
        var dailyStats = await GetDailyStatsMultiDeptAsync(from, to, deptFilter);

        // Load monitoring sessions for the period
        var sessionQuery = _db.MonitoringSessions.AsQueryable();
        if (from.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate >= DateOnly.FromDateTime(from.Value));
        if (to.HasValue) sessionQuery = sessionQuery.Where(s => s.SessionDate <= DateOnly.FromDateTime(to.Value));
        var monitoringSessions = await sessionQuery.OrderBy(s => s.SessionDate).ToListAsync();
        var sessionIds = monitoringSessions.Select(s => s.SessionID).ToList();
        var monEngQuery = _db.Engagements
            .AsNoTracking()
            .Include(e => e.Staff)
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Post).ThenInclude(p => p!.Company)
            .Where(e => sessionIds.Contains(e.SessionID));
        if (deptFilter != null)
            monEngQuery = monEngQuery.Where(e => deptFilter.Contains(e.Staff!.Department));
        var monitoringEngagements = await monEngQuery.ToListAsync();

        var dateRange = $"{from?.ToString("dd/MM/yyyy") ?? "All"} - {to?.ToString("dd/MM/yyyy") ?? "All"}";
        var accentColors = new[] { "#1e40af", "#059669", "#d97706", "#7c3aed", "#dc2626" };

        using var workbook = new XLWorkbook();

        // ════════════════════════════════════════════════════════════
        // Sheet 1: Summary & Rankings (Split by Unit, then Overall)
        // ════════════════════════════════════════════════════════════
        var ws1 = workbook.Worksheets.Add("Summary & Rankings");
        ws1.Cell(1, 1).Value = deptName != null ? $"SociHR — Performance & Engagement Summary ({deptName})" : "SociHR — Performance & Engagement Summary";
        StyleCell(ws1.Cell(1, 1), "#ffffff", "#1e40af", true, 18, XLBorderStyleValues.None);
        ws1.Cell(2, 1).Value = $"Period: {dateRange}";
        StyleCell(ws1.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);
        ws1.Cell(3, 1).Value = $"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}  •  System crafted by @syaakiirr";
        StyleCell(ws1.Cell(3, 1), "#ffffff", "#94a3b8", false, 9, XLBorderStyleValues.None);

        int curRow = 5;

        // 1. Performance Summary by Unit / Department
        WriteSectionTitle(ws1, curRow, 1, "1. Performance Summary by Unit / Department", "#4f46e5");
        var deptHeaders = new[] { "Unit / Department", "Total Staff", "Completed Ticks", "Missed Ticks", "Expected Ticks", "Completion Rate (%)" };
        WriteTableHeader(ws1, curRow + 1, 1, deptHeaders, "#4f46e5", "#ffffff");
        curRow += 2;

        for (int i = 0; i < deptStatsList.Count; i++)
        {
            var d = deptStatsList[i];
            WriteDataRow(ws1, curRow, 1, new object[] { d.Department, d.StaffCount, d.Completed, d.Missed, d.Total, $"{d.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
            var rColor = d.Rate >= 80 ? "#16a34a" : d.Rate >= 50 ? "#d97706" : "#dc2626";
            ws1.Cell(curRow, 6).Style.Font.FontColor = Html(rColor);
            ws1.Cell(curRow, 6).Style.Font.Bold = true;
            curRow++;
        }

        // Overall row in Unit summary table
        WriteDataRow(ws1, curRow, 1, new object[] { "OVERALL TOTAL", staffPerf.Count, totalCompleted, totalMissed, totalExpected, $"{overallRate}%" }, "#e0e7ff", "#e0e7ff", true);
        ws1.Cell(curRow, 1).Style.Font.Bold = true;
        ws1.Cell(curRow, 1).Style.Font.FontColor = Html("#312e81");
        ws1.Cell(curRow, 6).Style.Font.Bold = true;
        ws1.Cell(curRow, 6).Style.Font.FontColor = Html("#4338ca");
        curRow += 2;

        // 2. Overall KPI Cards
        WriteSectionTitle(ws1, curRow, 1, "2. Overall Key Performance Indicators (KPIs)", "#1e40af");
        var kpiHeaders = new[] { "Total Staff", "Completed", "Missed", "Expected", "Overall Rate" };
        var kpiValues = new object[] { staffPerf.Count, totalCompleted, totalMissed, totalExpected, $"{overallRate}%" };
        var kpiColors = new[] { "#6366f1", "#16a34a", "#dc2626", "#d97706", "#7c3aed" };
        for (int i = 0; i < kpiHeaders.Length; i++)
        {
            var headerCell = ws1.Cell(curRow + 1, i + 1);
            headerCell.Value = kpiHeaders[i];
            StyleCell(headerCell, "#f1f5f9", "#475569", true, 9);
            headerCell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

            var valCell = ws1.Cell(curRow + 2, i + 1);
            var kv = kpiValues[i];
            if (kv is string s) valCell.SetValue(s);
            else if (kv is int iv) valCell.SetValue(iv);
            else valCell.SetValue(kv?.ToString() ?? "");
            StyleCell(valCell, "#ffffff", kpiColors[i], true, 16);
            valCell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
        }
        curRow += 4;

        // 3. Top 5 Performing Staff by Unit
        WriteSectionTitle(ws1, curRow, 1, "3. Top 5 Performing Staff by Unit / Department", "#059669");
        curRow++;

        var unitRankHeaders = new[] { "Unit Rank", "Overall Rank", "Staff Name", "Department", "Position", "Completed", "Expected", "Rate (%)" };
        foreach (var dept in deptStatsList)
        {
            ws1.Cell(curRow, 1).Value = $"▶ Unit: {dept.Department} (Avg Rate: {dept.Rate}%)";
            ws1.Cell(curRow, 1).Style.Font.Bold = true;
            ws1.Cell(curRow, 1).Style.Font.FontSize = 11;
            ws1.Cell(curRow, 1).Style.Font.FontColor = Html("#059669");
            curRow++;

            WriteTableHeader(ws1, curRow, 1, unitRankHeaders, "#059669", "#ffffff");
            curRow++;

            for (int i = 0; i < dept.Top5.Count; i++)
            {
                var s = dept.Top5[i];
                var overallRank = staffPerf.FindIndex(sp => sp.StaffID == s.StaffID) + 1;
                WriteDataRow(ws1, curRow, 1, new object[] { s.Rank, overallRank, s.FullName, s.Department, s.Position, s.Completed, s.Total, $"{s.CompletionRate}%" }, "#f0fdf4", "#ffffff", i % 2 == 0);
                ws1.Cell(curRow, 8).Style.Font.FontColor = Html("#059669");
                ws1.Cell(curRow, 8).Style.Font.Bold = true;
                curRow++;
            }
            curRow++;
        }

        // 4. Overall Top 10 Performers
        WriteSectionTitle(ws1, curRow, 1, "4. Overall Top Performing Staff (Best 10)", "#16a34a");
        var overallRankHeaders = new[] { "Rank", "Staff Name", "Department", "Position", "Completed", "Expected", "Rate (%)" };
        WriteTableHeader(ws1, curRow + 1, 1, overallRankHeaders, "#16a34a", "#ffffff");
        curRow += 2;
        var top10 = staffPerf.Take(10).ToList();
        for (int i = 0; i < top10.Count; i++)
        {
            WriteDataRow(ws1, curRow, 1, new object[] { top10[i].Rank, top10[i].FullName, top10[i].Department, top10[i].Position, top10[i].Completed, top10[i].Total, $"{top10[i].CompletionRate}%" }, "#f0fdf4", "#ffffff", i % 2 == 0);
            ws1.Cell(curRow, 7).Style.Font.FontColor = Html("#16a34a");
            ws1.Cell(curRow, 7).Style.Font.Bold = true;
            curRow++;
        }
        curRow++;

        // 5. Overall Bottom 10 Performers
        WriteSectionTitle(ws1, curRow, 1, "5. Overall Least Performing Staff (Bottom 10)", "#dc2626");
        WriteTableHeader(ws1, curRow + 1, 1, overallRankHeaders, "#dc2626", "#ffffff");
        curRow += 2;
        var bottom10 = staffPerf.AsEnumerable().Reverse().Take(10).Reverse().ToList();
        for (int i = 0; i < bottom10.Count; i++)
        {
            WriteDataRow(ws1, curRow, 1, new object[] { bottom10[i].Rank, bottom10[i].FullName, bottom10[i].Department, bottom10[i].Position, bottom10[i].Completed, bottom10[i].Total, $"{bottom10[i].CompletionRate}%" }, "#fef2f2", "#ffffff", i % 2 == 0);
            ws1.Cell(curRow, 7).Style.Font.FontColor = Html("#dc2626");
            ws1.Cell(curRow, 7).Style.Font.Bold = true;
            curRow++;
        }

        ws1.Columns().AdjustToContents();

        // ════════════════════════════════════════════════════════════
        // Sheet 2: All Staff Performance (Grouped by Unit)
        // ════════════════════════════════════════════════════════════
        var ws2 = workbook.Worksheets.Add("All Staff Performance");
        ws2.Cell(1, 1).Value = "All Staff — Detailed Performance (Grouped by Unit)";
        StyleCell(ws2.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);
        ws2.Cell(2, 1).Value = $"Period: {dateRange}";
        StyleCell(ws2.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);

        int s2Row = 4;
        var detailHeaders = new[] { "Unit Rank", "Overall Rank", "Name", "Department", "Position", "Status", "Completed", "Missed", "Expected", "Rate (%)" };

        foreach (var dept in deptStatsList)
        {
            ws2.Cell(s2Row, 1).Value = $"Unit: {dept.Department}  •  {dept.StaffCount} Staff  •  Completion Rate: {dept.Rate}% ({dept.Completed}/{dept.Total} Ticks)";
            StyleCell(ws2.Cell(s2Row, 1), "#f3e8ff", "#6b21a8", true, 11);
            ws2.Range(s2Row, 1, s2Row, 10).Merge();
            s2Row++;

            WriteTableHeader(ws2, s2Row, 1, detailHeaders, "#7c3aed", "#ffffff");
            s2Row++;

            var sortedDeptStaff = dept.AllStaff.OrderByDescending(s => s.CompletionRate).ThenByDescending(s => s.Completed).ToList();
            for (int i = 0; i < sortedDeptStaff.Count; i++)
            {
                var s = sortedDeptStaff[i];
                WriteDataRow(ws2, s2Row, 1, new object[] { i + 1, s.Rank, s.FullName, s.Department, s.Position, s.Status, s.Completed, s.Missed, s.Total, $"{s.CompletionRate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
                var rateColor = s.CompletionRate >= 80 ? "#16a34a" : s.CompletionRate >= 50 ? "#d97706" : "#dc2626";
                ws2.Cell(s2Row, 10).Style.Font.FontColor = Html(rateColor);
                ws2.Cell(s2Row, 10).Style.Font.Bold = true;
                s2Row++;
            }
            s2Row++;
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
        var coHeaders = new[] { "Company", "Total Likes", "Total Comments", "Total Shares", "Completed", "Missed", "Expected", "Rate (%)" };
        WriteTableHeader(ws3, coTitleRow + 1, 1, coHeaders, "#7c3aed", "#ffffff");
        for (int i = 0; i < companyStats.Count; i++)
        {
            var r = coTitleRow + 2 + i;
            var c = companyStats[i];
            WriteDataRow(ws3, r, 1, new object[] { c.Company, c.Likes, c.Comments, c.Shares, c.Completed, c.Missed, c.Total, $"{c.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
            var rateColor = c.Rate >= 80 ? "#16a34a" : c.Rate >= 50 ? "#d97706" : "#dc2626";
            ws3.Cell(r, 8).Style.Font.FontColor = Html(rateColor);
            ws3.Cell(r, 8).Style.Font.Bold = true;
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
        var reqDepts = req.Departments != null && req.Departments.Count > 0 ? string.Join(",", req.Departments) : null;
        var deptFilter = await GetEffectiveDeptFilterAsync(reqDepts);
        var deptName = deptFilter?.Count == 1 ? deptFilter[0] : null;

        var staffQuery = _db.Staff.Where(s => !s.IsArchived);
        if (deptFilter != null) staffQuery = staffQuery.Where(s => deptFilter.Contains(s.Department));
        var staffList = await staffQuery.ToDictionaryAsync(s => s.StaffID);

        var ranking = await StaffRankingHelper.GetRankingMultiDept(_db, "top", null, req.DateFrom, req.DateTo, deptFilter);

        var staffPerf = ranking.Select((d, idx) =>
        {
            var staff = staffList.TryGetValue(d.StaffID, out var s) ? s : null;
            var missed = d.Total - d.Completed;
            return new StaffPerformanceDto
            {
                Rank = idx + 1,
                StaffID = d.StaffID,
                FullName = d.FullName,
                Department = string.IsNullOrWhiteSpace(d.Department) || d.Department == "-" ? "No Department" : d.Department,
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

        var deptStatsList = BuildDepartmentStats(staffPerf);
        var platformStats = req.IncludePlatformCompany ? await GetPlatformStatsAsync(req.DateFrom, req.DateTo, deptName) : new List<PlatformStatDto>();
        var companyStats = req.IncludePlatformCompany ? await GetCompanyStatsAsync(req.DateFrom, req.DateTo, deptName) : new List<CompanyStatDto>();
        var dailyStats = req.IncludeDaily ? await GetDailyStatsAsync(req.DateFrom, req.DateTo, deptName) : new List<DailyStatDto>();

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
            var monEngQuery = _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post).ThenInclude(p => p!.Platform)
                .Include(e => e.Post).ThenInclude(p => p!.Company)
                .Where(e => sids.Contains(e.SessionID));
            if (deptName != null)
                monEngQuery = monEngQuery.Where(e => e.Staff!.Department == deptName);
            monitoringEngagements = await monEngQuery.ToListAsync();
        }

        var dateRange = $"{req.DateFrom?.ToString("dd/MM/yyyy") ?? "All"} - {req.DateTo?.ToString("dd/MM/yyyy") ?? "All"}";
        var accentColors = new[] { "#1e40af", "#059669", "#d97706", "#7c3aed", "#dc2626" };

        using var workbook = new XLWorkbook();

        // ── Sheet: Summary ──
        if (req.IncludeSummaryCards || req.IncludeStaffRanking)
        {
            var wsSum = workbook.Worksheets.Add("Summary & Rankings");
            wsSum.Cell(1, 1).Value = deptName != null ? $"SociHR — Custom Performance Report ({deptName})" : "SociHR — Custom Performance Report";
            StyleCell(wsSum.Cell(1, 1), "#ffffff", "#1e40af", true, 18, XLBorderStyleValues.None);
            wsSum.Cell(2, 1).Value = $"Period: {dateRange}";
            StyleCell(wsSum.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);
            wsSum.Cell(3, 1).Value = $"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}  •  System crafted by @syaakiirr";
            StyleCell(wsSum.Cell(3, 1), "#ffffff", "#94a3b8", false, 9, XLBorderStyleValues.None);

            int cRow = 5;

            if (req.IncludeSummaryCards)
            {
                // Unit summary
                WriteSectionTitle(wsSum, cRow, 1, "1. Performance Summary by Unit / Department", "#4f46e5");
                var deptHeaders = new[] { "Unit / Department", "Total Staff", "Completed Ticks", "Missed Ticks", "Expected Ticks", "Completion Rate (%)" };
                WriteTableHeader(wsSum, cRow + 1, 1, deptHeaders, "#4f46e5", "#ffffff");
                cRow += 2;

                for (int i = 0; i < deptStatsList.Count; i++)
                {
                    var d = deptStatsList[i];
                    WriteDataRow(wsSum, cRow, 1, new object[] { d.Department, d.StaffCount, d.Completed, d.Missed, d.Total, $"{d.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
                    var rColor = d.Rate >= 80 ? "#16a34a" : d.Rate >= 50 ? "#d97706" : "#dc2626";
                    wsSum.Cell(cRow, 6).Style.Font.FontColor = Html(rColor);
                    wsSum.Cell(cRow, 6).Style.Font.Bold = true;
                    cRow++;
                }

                // Overall total row
                WriteDataRow(wsSum, cRow, 1, new object[] { "OVERALL TOTAL", staffPerf.Count, totalCompleted, totalMissed, totalExpected, $"{overallRate}%" }, "#e0e7ff", "#e0e7ff", true);
                wsSum.Cell(cRow, 1).Style.Font.Bold = true;
                wsSum.Cell(cRow, 1).Style.Font.FontColor = Html("#312e81");
                wsSum.Cell(cRow, 6).Style.Font.Bold = true;
                wsSum.Cell(cRow, 6).Style.Font.FontColor = Html("#4338ca");
                cRow += 2;

                // KPI cards
                WriteSectionTitle(wsSum, cRow, 1, "2. Overall Key Performance Indicators (KPIs)", "#1e40af");
                var kpiHeaders = new[] { "Total Staff", "Completed", "Missed", "Expected", "Overall Rate" };
                var kpiValues = new object[] { staffPerf.Count, totalCompleted, totalMissed, totalExpected, $"{overallRate}%" };
                var kpiColors = new[] { "#6366f1", "#16a34a", "#dc2626", "#d97706", "#7c3aed" };
                for (int i = 0; i < kpiHeaders.Length; i++)
                {
                    var hc = wsSum.Cell(cRow + 1, i + 1);
                    hc.Value = kpiHeaders[i];
                    StyleCell(hc, "#f1f5f9", "#475569", true, 9);
                    hc.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    var vc = wsSum.Cell(cRow + 2, i + 1);
                    var kv = kpiValues[i];
                    if (kv is string s) vc.SetValue(s);
                    else if (kv is int iv) vc.SetValue(iv);
                    else vc.SetValue(kv?.ToString() ?? "");
                    StyleCell(vc, "#ffffff", kpiColors[i], true, 16);
                    vc.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                }
                cRow += 4;
            }

            if (req.IncludeStaffRanking)
            {
                WriteSectionTitle(wsSum, cRow, 1, "Top 5 Performing Staff by Unit / Department", "#059669");
                cRow++;

                var unitRankHeaders = new[] { "Unit Rank", "Overall Rank", "Staff Name", "Department", "Position", "Completed", "Expected", "Rate (%)" };
                foreach (var dept in deptStatsList)
                {
                    wsSum.Cell(cRow, 1).Value = $"▶ Unit: {dept.Department} (Avg Rate: {dept.Rate}%)";
                    wsSum.Cell(cRow, 1).Style.Font.Bold = true;
                    wsSum.Cell(cRow, 1).Style.Font.FontSize = 11;
                    wsSum.Cell(cRow, 1).Style.Font.FontColor = Html("#059669");
                    cRow++;

                    WriteTableHeader(wsSum, cRow, 1, unitRankHeaders, "#059669", "#ffffff");
                    cRow++;

                    for (int i = 0; i < dept.Top5.Count; i++)
                    {
                        var s = dept.Top5[i];
                        var overallRank = staffPerf.FindIndex(sp => sp.StaffID == s.StaffID) + 1;
                        WriteDataRow(wsSum, cRow, 1, new object[] { s.Rank, overallRank, s.FullName, s.Department, s.Position, s.Completed, s.Total, $"{s.CompletionRate}%" }, "#f0fdf4", "#ffffff", i % 2 == 0);
                        wsSum.Cell(cRow, 8).Style.Font.FontColor = Html("#059669");
                        wsSum.Cell(cRow, 8).Style.Font.Bold = true;
                        cRow++;
                    }
                    cRow++;
                }

                // Overall Top 10
                WriteSectionTitle(wsSum, cRow, 1, "Overall Top Performing Staff (Best 10)", "#16a34a");
                var rankHeaders = new[] { "Rank", "Name", "Department", "Position", "Completed", "Expected", "Rate (%)" };
                WriteTableHeader(wsSum, cRow + 1, 1, rankHeaders, "#16a34a", "#ffffff");
                cRow += 2;
                var top10 = staffPerf.Take(10).ToList();
                for (int i = 0; i < top10.Count; i++)
                {
                    WriteDataRow(wsSum, cRow, 1, new object[] { top10[i].Rank, top10[i].FullName, top10[i].Department, top10[i].Position, top10[i].Completed, top10[i].Total, $"{top10[i].CompletionRate}%" }, "#f0fdf4", "#ffffff", i % 2 == 0);
                    wsSum.Cell(cRow, 7).Style.Font.FontColor = Html("#16a34a");
                    wsSum.Cell(cRow, 7).Style.Font.Bold = true;
                    cRow++;
                }
                cRow++;

                // Overall Bottom 10
                WriteSectionTitle(wsSum, cRow, 1, "Overall Least Performing Staff (Bottom 10)", "#dc2626");
                WriteTableHeader(wsSum, cRow + 1, 1, rankHeaders, "#dc2626", "#ffffff");
                cRow += 2;
                var bottom10 = staffPerf.AsEnumerable().Reverse().Take(10).Reverse().ToList();
                for (int i = 0; i < bottom10.Count; i++)
                {
                    WriteDataRow(wsSum, cRow, 1, new object[] { bottom10[i].Rank, bottom10[i].FullName, bottom10[i].Department, bottom10[i].Position, bottom10[i].Completed, bottom10[i].Total, $"{bottom10[i].CompletionRate}%" }, "#fef2f2", "#ffffff", i % 2 == 0);
                    wsSum.Cell(cRow, 7).Style.Font.FontColor = Html("#dc2626");
                    wsSum.Cell(cRow, 7).Style.Font.Bold = true;
                    cRow++;
                }
            }

            wsSum.Columns().AdjustToContents();
        }

        // ── Sheet: All Staff ──
        if (req.IncludeStaffTable)
        {
            var wsStaff = workbook.Worksheets.Add("All Staff Performance");
            wsStaff.Cell(1, 1).Value = "All Staff — Detailed Performance (Grouped by Unit)";
            StyleCell(wsStaff.Cell(1, 1), "#ffffff", "#7c3aed", true, 16, XLBorderStyleValues.None);
            wsStaff.Cell(2, 1).Value = $"Period: {dateRange}";
            StyleCell(wsStaff.Cell(2, 1), "#ffffff", "#475569", false, 11, XLBorderStyleValues.None);

            int sRow = 4;
            var detailHeaders = new[] { "Unit Rank", "Overall Rank", "Name", "Department", "Position", "Status", "Completed", "Missed", "Expected", "Rate (%)" };

            foreach (var dept in deptStatsList)
            {
                wsStaff.Cell(sRow, 1).Value = $"Unit: {dept.Department}  •  {dept.StaffCount} Staff  •  Completion Rate: {dept.Rate}% ({dept.Completed}/{dept.Total} Ticks)";
                StyleCell(wsStaff.Cell(sRow, 1), "#f3e8ff", "#6b21a8", true, 11);
                wsStaff.Range(sRow, 1, sRow, 10).Merge();
                sRow++;

                WriteTableHeader(wsStaff, sRow, 1, detailHeaders, "#7c3aed", "#ffffff");
                sRow++;

                var sortedDeptStaff = dept.AllStaff.OrderByDescending(s => s.CompletionRate).ThenByDescending(s => s.Completed).ToList();
                for (int i = 0; i < sortedDeptStaff.Count; i++)
                {
                    var s = sortedDeptStaff[i];
                    WriteDataRow(wsStaff, sRow, 1, new object[] { i + 1, s.Rank, s.FullName, s.Department, s.Position, s.Status, s.Completed, s.Missed, s.Total, $"{s.CompletionRate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
                    var rateColor = s.CompletionRate >= 80 ? "#16a34a" : s.CompletionRate >= 50 ? "#d97706" : "#dc2626";
                    wsStaff.Cell(sRow, 10).Style.Font.FontColor = Html(rateColor);
                    wsStaff.Cell(sRow, 10).Style.Font.Bold = true;
                    sRow++;
                }
                sRow++;
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
            var coHeaders = new[] { "Company", "Total Likes", "Total Comments", "Total Shares", "Completed", "Missed", "Expected", "Rate (%)" };
            WriteTableHeader(wsPC, coTitleRow + 1, 1, coHeaders, "#7c3aed", "#ffffff");
            for (int i = 0; i < companyStats.Count; i++)
            {
                var r = coTitleRow + 2 + i;
                var c = companyStats[i];
                WriteDataRow(wsPC, r, 1, new object[] { c.Company, c.Likes, c.Comments, c.Shares, c.Completed, c.Missed, c.Total, $"{c.Rate}%" }, "#f8fafc", "#ffffff", i % 2 == 0);
                var rateColor = c.Rate >= 80 ? "#16a34a" : c.Rate >= 50 ? "#d97706" : "#dc2626";
                wsPC.Cell(r, 8).Style.Font.FontColor = Html(rateColor);
                wsPC.Cell(r, 8).Style.Font.Bold = true;
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

    // GET /api/reports/pdf?from=2026-01-01&to=2026-12-31&departments=HR,Ageing
    [HttpGet("pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool showCards = true,
        [FromQuery] bool showRanking = true,
        [FromQuery] bool showPlatformCompany = true,
        [FromQuery] bool showDaily = true,
        [FromQuery] bool showStaffTable = true,
        [FromQuery] bool showMonitoringSessions = true,
        [FromQuery] string? departments = null)
    {
        try
        {
        QuestPDF.Settings.License = LicenseType.Community;

        var deptFilter = await GetEffectiveDeptFilterAsync(departments);
        var deptName = deptFilter?.Count == 1 ? deptFilter[0] : null;

        var staffQuery = _db.Staff.Where(s => !s.IsArchived);
        if (deptFilter != null) staffQuery = staffQuery.Where(s => deptFilter.Contains(s.Department));
        var staffList = await staffQuery.ToDictionaryAsync(s => s.StaffID);

        var staffEngagementCounts = await _db.Engagements
            .AsNoTracking()
            .Where(e => !e.Staff!.IsArchived && !e.Session!.IsArchived)
            .Where(e => !from.HasValue || e.Session!.SessionDate >= DateOnly.FromDateTime(from.Value))
            .Where(e => !to.HasValue || e.Session!.SessionDate <= DateOnly.FromDateTime(to.Value))
            .GroupBy(e => e.StaffID)
            .Select(g => new {
                StaffID = g.Key,
                Likes = g.Count(e => e.IsLiked),
                Comments = g.Count(e => e.IsCommented),
                Shares = g.Count(e => e.IsShared)
            })
            .ToDictionaryAsync(g => g.StaffID);

        var ranking = await StaffRankingHelper.GetRankingMultiDept(_db, "top", null, from, to, deptFilter);

        var staffPerf = ranking.Select((d, idx) =>
        {
            var staff = staffList.TryGetValue(d.StaffID, out var s) ? s : null;
            var counts = staffEngagementCounts.TryGetValue(d.StaffID, out var c) ? c : null;
            var missed = d.Total - d.Completed;
            return new StaffPerformanceDto
            {
                Rank = idx + 1,
                StaffID = d.StaffID,
                FullName = d.FullName,
                Department = string.IsNullOrWhiteSpace(d.Department) || d.Department == "-" ? "No Department" : d.Department,
                Position = staff?.Position ?? "Staff",
                Status = staff?.Status ?? "Active",
                Likes = counts?.Likes ?? 0,
                Comments = counts?.Comments ?? 0,
                Shares = counts?.Shares ?? 0,
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
        var totalLikes = staffPerf.Sum(s => s.Likes);
        var totalComments = staffPerf.Sum(s => s.Comments);
        var totalShares = staffPerf.Sum(s => s.Shares);

        var deptStatsList = BuildDepartmentStats(staffPerf);
        var platformStats = await GetPlatformStatsMultiDeptAsync(from, to, deptFilter);
        var companyStats = await GetCompanyStatsMultiDeptAsync(from, to, deptFilter);
        var dailyStats = await GetDailyStatsMultiDeptAsync(from, to, deptFilter);

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
            var monEngQuery = _db.Engagements
                .Include(e => e.Post).ThenInclude(p => p!.Platform)
                .Include(e => e.Post).ThenInclude(p => p!.Company)
                .Include(e => e.Staff)
                .Where(e => sids.Any(id => id == e.SessionID));
            if (deptFilter != null)
                monEngQuery = monEngQuery.Where(e => deptFilter.Contains(e.Staff!.Department));
            monitoringEngagements = await monEngQuery.ToListAsync();
        }

        string sessionDateTitle;
        if (monitoringSessions != null && monitoringSessions.Count == 1)
        {
            sessionDateTitle = $"Session: {monitoringSessions[0].SessionDate:dd MMMM yyyy}";
        }
        else if (monitoringSessions != null && monitoringSessions.Count > 1)
        {
            var firstDate = monitoringSessions.First().SessionDate;
            var lastDate = monitoringSessions.Last().SessionDate;
            sessionDateTitle = $"{firstDate:dd MMM yyyy} to {lastDate:dd MMM yyyy} ({monitoringSessions.Count} Sessions)";
        }
        else if (from.HasValue && to.HasValue)
        {
            if (from.Value.Date == to.Value.Date)
                sessionDateTitle = $"{from.Value:dd MMMM yyyy}";
            else
                sessionDateTitle = $"{from.Value:dd MMM yyyy} to {to.Value:dd MMM yyyy}";
        }
        else
        {
            sessionDateTitle = "All Recorded Sessions";
        }

        var pdf = Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(26);
                page.DefaultTextStyle(t => t.FontSize(9));

                page.Content().Column(col =>
                {
                    bool isFirstSection = true;

                    // ───── PART 1: INDIVIDUAL SESSIONS (Settled One by One in Chronological Order) ─────
                    if (showMonitoringSessions && monitoringSessions != null && monitoringEngagements != null && monitoringSessions.Count > 0)
                    {
                        for (int sIdx = 0; sIdx < monitoringSessions.Count; sIdx++)
                        {
                            var session = monitoringSessions[sIdx];
                            var sessionEngs = monitoringEngagements.Where(e => e.SessionID == session.SessionID).ToList();
                            if (!sessionEngs.Any()) continue;

                            var rd = MonitoringSessionController.BuildReportData(session, sessionEngs);
                            if (deptFilter != null)
                            {
                                rd.StaffRows = rd.StaffRows.Where(r => deptFilter.Contains(r.Department)).ToList();
                            }
                            if (rd.StaffRows.Count == 0) continue;

                            if (deptFilter?.Count == 1)
                            {
                                // ── SINGLE DEPARTMENT SESSION FLOW ──
                                if (!isFirstSection) col.Item().PageBreak();
                                isFirstSection = false;

                                // Session Header Card
                                col.Item().PaddingBottom(8).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(8).Row(r =>
                                {
                                    r.RelativeItem().Column(rc =>
                                    {
                                        rc.Item().Text($"Session {sIdx + 1} of {monitoringSessions.Count}").FontSize(8.5f).Bold().FontColor("#64748b");
                                        rc.Item().PaddingTop(1).Text($"Date: {session.SessionDate:dddd, dd MMMM yyyy}").FontSize(13).Bold().FontColor("#0f172a");
                                    });
                                    r.ConstantItem(260).AlignRight().Column(rc =>
                                    {
                                        rc.Item().Text($"Scope: {deptName}").FontSize(8.5f).Bold().FontColor("#334155");
                                        rc.Item().PaddingTop(1).Text($"Staff Evaluated: {rd.StaffRows.Count}  |  Likes: {rd.TotalLikes}  Comments: {rd.TotalComments}  Shares: {rd.TotalShares}").FontSize(8f).FontColor("#64748b");
                                    });
                                });

                                // Session KPI Summary Cards
                                col.Item().PaddingBottom(6).Row(row =>
                                {
                                    row.RelativeItem().Element(c => Card(c, "Total Likes", rd.TotalLikes.ToString(), "#2563eb", "#eff6ff"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Total Comments", rd.TotalComments.ToString(), "#0284c7", "#f0f9ff"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Total Shares", rd.TotalShares.ToString(), "#059669", "#f0fdf4"));
                                });

                                // 1. Company Engagement Breakdown Table
                                if (rd.CompanyStats.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(cc =>
                                    {
                                        cc.Item().PaddingBottom(2).Text($"Company Engagement Breakdown ({session.SessionDate:dd/MM/yyyy})").FontSize(9f).Bold().FontColor("#0f172a");
                                        cc.Item().Element(t => RenderCompanyBreakdownTable(t, rd.CompanyStats));
                                    });
                                }

                                // 2. Platform Engagement Breakdown Table
                                if (rd.PlatformStats.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(pc =>
                                    {
                                        pc.Item().PaddingBottom(2).Text($"Platform Engagement Breakdown ({session.SessionDate:dd/MM/yyyy})").FontSize(9f).Bold().FontColor("#0f172a");
                                        pc.Item().Element(t => RenderPlatformBreakdownTable(t, rd.PlatformStats));
                                    });
                                }

                                // 3. Top 5 Table
                                col.Item().PaddingBottom(6).Column(c =>
                                {
                                    c.Item().PaddingBottom(2).Text($"Top 5: {deptName} ({session.SessionDate:dd/MM/yyyy})").FontSize(9f).Bold().FontColor("#059669");
                                    c.Item().Element(t => RenderSessionTop5Table(t, rd.StaffRows));
                                });

                                // 4. Staff Tick Detail (dedicated page)
                                col.Item().PageBreak();
                                col.Item().PaddingBottom(4).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                                {
                                    r.RelativeItem().Text($"Staff Tick Detail: {deptName} ({session.SessionDate:dd/MM/yyyy})").FontSize(11).Bold().FontColor("#0f172a");
                                    r.ConstantItem(260).AlignRight().Text($"Scope: {deptName}  |  Total Staff: {rd.StaffRows.Count}").FontSize(8f).FontColor("#475569");
                                });
                                col.Item().PaddingTop(2).PaddingBottom(6).Element(t => RenderSessionStaffTickTable(t, rd.StaffRows));

                                // 5. Staff Engagement Matrix (dedicated page)
                                col.Item().PageBreak();
                                col.Item().PaddingBottom(4).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                                {
                                    r.RelativeItem().Text($"Staff Engagement Matrix: {session.SessionDate:dddd, dd MMMM yyyy}").FontSize(11).Bold().FontColor("#0f172a");
                                    r.ConstantItem(260).AlignRight().Text($"Scope: {deptName}  |  Staff: {rd.StaffRows.Count}  |  Likes: {rd.TotalLikes}  Comments: {rd.TotalComments}  Shares: {rd.TotalShares}").FontSize(8f).FontColor("#475569");
                                });
                                col.Item().PaddingTop(2).PaddingBottom(4).Element(t => RenderMonitoringTable(t, rd));


                            }
                            else
                            {
                                // ── OVERALL / SUPERADMIN SESSION FLOW (Grouped by Department without page mixing) ──
                                if (!isFirstSection) col.Item().PageBreak();
                                isFirstSection = false;

                                // Session Executive Overview Header
                                col.Item().PaddingBottom(8).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(8).Row(r =>
                                {
                                    r.RelativeItem().Column(rc =>
                                    {
                                        rc.Item().Text($"Session {sIdx + 1} of {monitoringSessions.Count}").FontSize(8.5f).Bold().FontColor("#64748b");
                                        rc.Item().PaddingTop(1).Text($"Date: {session.SessionDate:dddd, dd MMMM yyyy}").FontSize(13).Bold().FontColor("#0f172a");
                                    });
                                    r.ConstantItem(280).AlignRight().Column(rc =>
                                    {
                                        rc.Item().Text("Scope: All Departments").FontSize(8.5f).Bold().FontColor("#0f172a");
                                        rc.Item().PaddingTop(1).Text($"Staff Evaluated: {rd.StaffRows.Count}  |  Likes: {rd.TotalLikes}  Comments: {rd.TotalComments}  Shares: {rd.TotalShares}").FontSize(8f).FontColor("#64748b");
                                    });
                                });

                                // Session KPI Summary Cards
                                col.Item().PaddingBottom(6).Row(row =>
                                {
                                    row.RelativeItem().Element(c => Card(c, "Total Likes", rd.TotalLikes.ToString(), "#2563eb", "#eff6ff"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Total Comments", rd.TotalComments.ToString(), "#0284c7", "#f0f9ff"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Total Shares", rd.TotalShares.ToString(), "#059669", "#f0fdf4"));
                                });

                                // Company Engagement Breakdown Table
                                if (rd.CompanyStats.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(cc =>
                                    {
                                        cc.Item().PaddingBottom(2).Text($"Company Engagement Breakdown ({session.SessionDate:dd/MM/yyyy})").FontSize(9f).Bold().FontColor("#0f172a");
                                        cc.Item().Element(t => RenderCompanyBreakdownTable(t, rd.CompanyStats));
                                    });
                                }

                                // Platform Engagement Breakdown Table
                                if (rd.PlatformStats.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(pc =>
                                    {
                                        pc.Item().PaddingBottom(2).Text($"Platform Engagement Breakdown ({session.SessionDate:dd/MM/yyyy})").FontSize(9f).Bold().FontColor("#0f172a");
                                        pc.Item().Element(t => RenderPlatformBreakdownTable(t, rd.PlatformStats));
                                    });
                                }

                                // Overall Top 5 shown once in PART 2 consolidated — skip here to avoid duplicate

                                // ── PER-DEPARTMENT PAGES IN THIS SESSION (Guaranteed isolated page per department) ──
                                var sessionDeptGroups = rd.StaffRows
                                    .GroupBy(r => string.IsNullOrWhiteSpace(r.Department) ? "No Department" : r.Department)
                                    .OrderBy(g => g.Key == "No Department" ? "ZZZ" : g.Key)
                                    .ToList();

                                foreach (var dGroup in sessionDeptGroups)
                                {
                                    var curDeptName = dGroup.Key;
                                    var curDeptStaff = dGroup.ToList();
                                    var curDeptEngs = sessionEngs.Where(e => (e.Staff?.Department ?? "No Department") == curDeptName).ToList();
                                    var deptRd = MonitoringSessionController.BuildReportData(session, curDeptEngs);

                                    // Dedicated Page for Department's Staff Ticks:
                                    col.Item().PageBreak();
                                    col.Item().PaddingBottom(4).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                                    {
                                        r.RelativeItem().Text($"Staff Tick Detail: {curDeptName} ({session.SessionDate:dd/MM/yyyy})").FontSize(11).Bold().FontColor("#0f172a");
                                        r.ConstantItem(260).AlignRight().Text($"Department: {curDeptName}  |  Staff: {curDeptStaff.Count}").FontSize(8f).FontColor("#475569");
                                    });

                                    // Top 5 for this department in this session
                                    col.Item().PaddingTop(2).PaddingBottom(4).Column(c =>
                                    {
                                        c.Item().PaddingBottom(2).Text($"Top 5: {curDeptName} ({session.SessionDate:dd/MM/yyyy})").FontSize(8.5f).Bold().FontColor("#059669");
                                        c.Item().Element(t => RenderSessionTop5Table(t, curDeptStaff));
                                    });

                                    // Full staff ticks for this department
                                    col.Item().PaddingTop(2).PaddingBottom(6).Element(t => RenderSessionStaffTickTable(t, curDeptStaff));

                                    // Dedicated Page for Department's Matrix:
                                    col.Item().PageBreak();
                                    col.Item().PaddingBottom(4).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                                    {
                                        r.RelativeItem().Text($"Staff Engagement Matrix: {curDeptName} ({session.SessionDate:dddd, dd MMMM yyyy})").FontSize(11).Bold().FontColor("#0f172a");
                                        r.ConstantItem(280).AlignRight().Text($"Scope: {curDeptName}  |  Staff: {deptRd.StaffRows.Count}  |  Likes: {deptRd.TotalLikes}  Comments: {deptRd.TotalComments}  Shares: {deptRd.TotalShares}").FontSize(7.5f).FontColor("#475569");
                                    });
                                    col.Item().PaddingTop(2).PaddingBottom(4).Element(t => RenderMonitoringTable(t, deptRd));
                                }
                            }
                        }
                    }

                    // ───── PART 2: CONSOLIDATED SUMMARY (Multi-Session / Period Overview) ─────
                    // Show PART 2 only when:
                    //   (a) session detail NOT rendered in PART 1 (showMonitoringSessions=false), OR
                    //   (b) MULTIPLE sessions → consolidated aggregate across sessions is useful
                    // SKIP when single session already fully rendered in PART 1 (would be duplicate)
                    int sessionCount = monitoringSessions?.Count ?? 0;
                    bool shouldShowConsolidated = !showMonitoringSessions || sessionCount != 1;

                    if (shouldShowConsolidated)
                    {
                        if (!isFirstSection) col.Item().PageBreak();
                        isFirstSection = false;

                        if (deptName != null)
                        {
                            // ── SINGLE DEPARTMENT CONSOLIDATED DOSSIER ──
                            var singleDept = deptStatsList.FirstOrDefault();
                            if (singleDept != null)
                            {
                                // Header Banner
                                col.Item().PaddingBottom(8).Row(r =>
                                {
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text($"SociHR Engagement Report ({singleDept.Department})").FontSize(15).Bold().FontColor("#0f172a");
                                        c.Item().PaddingTop(2).Row(sr =>
                                        {
                                            sr.AutoItem().Background("#f1f5f9").Border(1).BorderColor("#cbd5e1").PaddingHorizontal(6).PaddingVertical(2).Text(t =>
                                            {
                                                t.Span("Department: ").FontSize(8f).FontColor("#64748b");
                                                t.Span(singleDept.Department).FontSize(8.5f).Bold().FontColor("#0f172a");
                                            });
                                            sr.AutoItem().PaddingLeft(6).Background("#eff6ff").Border(1).BorderColor("#bfdbfe").PaddingHorizontal(6).PaddingVertical(2).Text(t =>
                                            {
                                                t.Span("Period: ").FontSize(8f).FontColor("#1d4ed8");
                                                t.Span(sessionDateTitle).FontSize(8.5f).Bold().FontColor("#1e40af");
                                            });
                                        });
                                        c.Item().PaddingTop(2).Text($"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}").FontSize(7.5f).FontColor("#94a3b8");
                                        c.Item().PaddingTop(1).Text("System crafted by @syaakiirr").FontSize(7.5f).FontColor("#94a3b8");
                                    });
                                    r.ConstantItem(240).Background("#f8fafc").Border(1).BorderColor("#e2e8f0").Padding(5).Column(c =>
                                    {
                                        c.Item().Row(cr => {
                                            cr.RelativeItem().Text("Active Staff:").FontSize(8f).FontColor("#64748b");
                                            cr.ConstantItem(60).AlignRight().Text(singleDept.StaffCount.ToString()).FontSize(8f).Bold();
                                        });
                                        c.Item().Row(cr => {
                                            cr.RelativeItem().Text("Completed Ticks:").FontSize(8f).FontColor("#16a34a");
                                            cr.ConstantItem(60).AlignRight().Text(singleDept.Completed.ToString()).FontSize(8f).Bold().FontColor("#16a34a");
                                        });
                                        c.Item().Row(cr => {
                                            cr.RelativeItem().Text("Missed Ticks:").FontSize(8f).FontColor("#dc2626");
                                            cr.ConstantItem(60).AlignRight().Text(singleDept.Missed.ToString()).FontSize(8f).Bold().FontColor("#dc2626");
                                        });
                                        c.Item().Row(cr => {
                                            cr.RelativeItem().Text("Overall Rate:").FontSize(8.5f).Bold().FontColor("#0f172a");
                                            cr.ConstantItem(60).AlignRight().Text($"{singleDept.Rate}%").FontSize(8.5f).Bold().FontColor("#0f172a");
                                        });
                                    });
                                });
                                col.Item().PaddingBottom(8).LineHorizontal(1).LineColor("#e2e8f0");

                                // KPI Summary Cards
                                if (showCards)
                                {
                                    col.Item().PaddingBottom(8).Row(row =>
                                    {
                                        row.RelativeItem().Element(c => Card(c, "Total Staff", singleDept.StaffCount.ToString(), "#3b82f6", "#eff6ff"));
                                        row.ConstantItem(8);
                                        row.RelativeItem().Element(c => Card(c, "Total Likes", singleDept.Likes.ToString(), "#2563eb", "#eff6ff"));
                                        row.ConstantItem(8);
                                        row.RelativeItem().Element(c => Card(c, "Total Comments", singleDept.Comments.ToString(), "#0284c7", "#f0f9ff"));
                                        row.ConstantItem(8);
                                        row.RelativeItem().Element(c => Card(c, "Total Shares", singleDept.Shares.ToString(), "#059669", "#f0fdf4"));
                                        row.ConstantItem(8);
                                        row.RelativeItem().Element(c => Card(c, "Completion Rate", $"{singleDept.Rate}%", singleDept.Rate >= 80 ? "#16a34a" : singleDept.Rate >= 50 ? "#d97706" : "#dc2626", "#f8fafc"));
                                    });
                                }

                                // Platform & Company Breakdowns
                                if (showPlatformCompany && platformStats.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(c =>
                                    {
                                        c.Item().PaddingBottom(2).Text($"Platform Engagement Breakdown ({singleDept.Department})").FontSize(9f).Bold().FontColor("#0f172a");
                                        c.Item().Element(t => PlatformTable(t, platformStats));
                                    });
                                }
                                if (showPlatformCompany && companyStats.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(c =>
                                    {
                                        c.Item().PaddingBottom(2).Text($"Company Engagement Breakdown ({singleDept.Department})").FontSize(9f).Bold().FontColor("#0f172a");
                                        c.Item().Element(t => CompanyTable(t, companyStats));
                                    });
                                }

                                // Top 5 Table
                                if (showRanking && singleDept.Top5.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(c =>
                                    {
                                        c.Item().PaddingBottom(2).Text($"Top 5 Performing Staff ({singleDept.Department})").FontSize(9.5f).Bold().FontColor("#059669");
                                        c.Item().Element(t => RenderDepartmentTop5Table(t, singleDept.Top5));
                                    });
                                }

                                // Dedicated Page for Complete Staff Ticks
                                if (showStaffTable && singleDept.AllStaff.Count > 0)
                                {
                                    col.Item().PageBreak();
                                    col.Item().PaddingBottom(4).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                                    {
                                        r.RelativeItem().Text($"Staff Engagement Ticks: {singleDept.Department}").FontSize(11).Bold().FontColor("#0f172a");
                                        r.ConstantItem(260).AlignRight().Text($"Total Staff: {singleDept.StaffCount}  |  Avg Rate: {singleDept.Rate}%").FontSize(8f).FontColor("#475569");
                                    });
                                    col.Item().PaddingTop(2).Element(t => RenderDepartmentAllStaffTable(t, singleDept.AllStaff));
                                }
                            }
                        }
                        else
                        {
                            // ── OVERALL / SUPERADMIN CONSOLIDATED DOSSIER ──
                            // Page 1: Executive Enterprise Overview Banner
                            col.Item().PaddingBottom(8).Row(r =>
                            {
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("SociHR Enterprise Engagement Report").FontSize(15).Bold().FontColor("#0f172a");
                                    c.Item().PaddingTop(2).Row(sr =>
                                    {
                                        sr.AutoItem().Background("#f1f5f9").Border(1).BorderColor("#cbd5e1").PaddingHorizontal(6).PaddingVertical(2).Text(t =>
                                        {
                                            t.Span("Scope: ").FontSize(8f).FontColor("#64748b");
                                            t.Span("All Departments (Executive Master)").FontSize(8.5f).Bold().FontColor("#0f172a");
                                        });
                                        sr.AutoItem().PaddingLeft(6).Background("#eff6ff").Border(1).BorderColor("#bfdbfe").PaddingHorizontal(6).PaddingVertical(2).Text(t =>
                                        {
                                            t.Span("Period: ").FontSize(8f).FontColor("#1d4ed8");
                                            t.Span(sessionDateTitle).FontSize(8.5f).Bold().FontColor("#1e40af");
                                        });
                                    });
                                    c.Item().PaddingTop(2).Text($"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}").FontSize(7.5f).FontColor("#94a3b8");
                                    c.Item().PaddingTop(1).Text("System crafted by @syaakiirr").FontSize(7.5f).FontColor("#94a3b8");
                                });
                                r.ConstantItem(240).Background("#f8fafc").Border(1).BorderColor("#e2e8f0").Padding(5).Column(c =>
                                {
                                    c.Item().Row(cr => {
                                        cr.RelativeItem().Text("Total Active Staff:").FontSize(8f).FontColor("#64748b");
                                        cr.ConstantItem(60).AlignRight().Text(staffPerf.Count.ToString()).FontSize(8f).Bold();
                                    });
                                    c.Item().Row(cr => {
                                        cr.RelativeItem().Text("Completed Ticks:").FontSize(8f).FontColor("#16a34a");
                                        cr.ConstantItem(60).AlignRight().Text(totalCompleted.ToString()).FontSize(8f).Bold().FontColor("#16a34a");
                                    });
                                    c.Item().Row(cr => {
                                        cr.RelativeItem().Text("Missed Ticks:").FontSize(8f).FontColor("#dc2626");
                                        cr.ConstantItem(60).AlignRight().Text(totalMissed.ToString()).FontSize(8f).Bold().FontColor("#dc2626");
                                    });
                                    c.Item().Row(cr => {
                                        cr.RelativeItem().Text("Overall Rate:").FontSize(8.5f).Bold().FontColor("#0f172a");
                                        cr.ConstantItem(60).AlignRight().Text($"{overallRate}%").FontSize(8.5f).Bold().FontColor("#0f172a");
                                    });
                                });
                            });
                            col.Item().PaddingBottom(8).LineHorizontal(1).LineColor("#e2e8f0");

                            // Enterprise KPI Summary Cards
                            if (showCards)
                            {
                                col.Item().PaddingBottom(8).Row(row =>
                                {
                                    row.RelativeItem().Element(c => Card(c, "Total Staff", staffPerf.Count.ToString(), "#3b82f6", "#eff6ff"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Total Likes", totalLikes.ToString(), "#2563eb", "#eff6ff"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Total Comments", totalComments.ToString(), "#0284c7", "#f0f9ff"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Total Shares", totalShares.ToString(), "#059669", "#f0fdf4"));
                                    row.ConstantItem(8);
                                    row.RelativeItem().Element(c => Card(c, "Overall Rate", $"{overallRate}%", overallRate >= 80 ? "#16a34a" : overallRate >= 50 ? "#d97706" : "#dc2626", "#f8fafc"));
                                });
                            }

                            // Department Performance Breakdown Table
                            col.Item().PaddingBottom(8).Column(c =>
                            {
                                c.Item().PaddingBottom(2).Text("Department Performance Breakdown").FontSize(10f).Bold().FontColor("#0f172a");
                                c.Item().Element(t => RenderDepartmentSummaryComparisonTable(t, deptStatsList, staffPerf.Count, totalCompleted, totalMissed, totalExpected, overallRate, totalLikes, totalComments, totalShares));
                            });

                            // Platform & Company Breakdowns
                            if (showPlatformCompany && platformStats.Count > 0)
                            {
                                col.Item().PaddingBottom(6).Column(c =>
                                {
                                    c.Item().PaddingBottom(2).Text("Platform Engagement Breakdown").FontSize(9f).Bold().FontColor("#0f172a");
                                    c.Item().Element(t => PlatformTable(t, platformStats));
                                });
                            }
                            if (showPlatformCompany && companyStats.Count > 0)
                            {
                                col.Item().PaddingBottom(6).Column(c =>
                                {
                                    c.Item().PaddingBottom(2).Text("Company Engagement Breakdown").FontSize(9f).Bold().FontColor("#0f172a");
                                    c.Item().Element(t => CompanyTable(t, companyStats));
                                });
                            }

                            // Page 2: Company-Wide Talent Rankings (Overall Top 10 + Overall Bottom 10)
                            if (showRanking)
                            {
                                col.Item().PageBreak();
                                col.Item().PaddingBottom(6).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                                {
                                    r.RelativeItem().Text("Company-Wide Talent Rankings (All Departments)").FontSize(11).Bold().FontColor("#0f172a");
                                    r.ConstantItem(260).AlignRight().Text($"Total Evaluated: {staffPerf.Count} Staff").FontSize(8f).FontColor("#475569");
                                });

                                // Overall Top 10
                                col.Item().PaddingBottom(8).Column(c =>
                                {
                                    c.Item().PaddingBottom(2).Text("Top Performing Staff (Best 10 - All Units)").FontSize(9.5f).Bold().FontColor("#16a34a");
                                    c.Item().Element(t => RenderOverallTopStaffTable(t, staffPerf.Take(10).ToList()));
                                });

                                // Overall Bottom 10
                                var bottom10 = staffPerf.AsEnumerable().Reverse().Take(10).Reverse().ToList();
                                if (bottom10.Count > 0 && staffPerf.Count > 10)
                                {
                                    col.Item().PaddingBottom(8).Column(c =>
                                    {
                                        c.Item().PaddingBottom(2).Text("Least Performing Staff (Bottom 10 - All Units)").FontSize(9.5f).Bold().FontColor("#dc2626");
                                        c.Item().Element(t => RenderOverallBottomStaffTable(t, bottom10));
                                    });
                                }
                            }

                            // ── Page 3+: DEDICATED PAGE PER DEPARTMENT DOSSIER (Zero department page mixing!) ──
                            for (int di = 0; di < deptStatsList.Count; di++)
                            {
                                var dept = deptStatsList[di];
                                // MANDATORY DEDICATED PAGE BREAK FOR EVERY DEPARTMENT:
                                col.Item().PageBreak();

                                // Department Header Card
                                col.Item().PaddingBottom(6).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                                {
                                    r.RelativeItem().Column(rc =>
                                    {
                                        rc.Item().Text($"Department Dossier: {dept.Department}").FontSize(12).Bold().FontColor("#0f172a");
                                        rc.Item().PaddingTop(1).Text($"Coverage: {sessionDateTitle}").FontSize(7.5f).FontColor("#64748b");
                                    });
                                    r.ConstantItem(280).AlignRight().Column(rc =>
                                    {
                                        rc.Item().Text($"{dept.StaffCount} Staff Evaluated  |  Avg Rate: {dept.Rate}%").FontSize(8.5f).Bold().FontColor("#0f172a");
                                        rc.Item().PaddingTop(1).Text($"Likes: {dept.Likes}  |  Comments: {dept.Comments}  |  Shares: {dept.Shares}  |  Ticks: {dept.Completed}/{dept.Total}").FontSize(7.5f).FontColor("#475569");
                                    });
                                });

                                // Department Micro KPI Row
                                col.Item().PaddingBottom(6).Row(row =>
                                {
                                    row.RelativeItem().Element(c => Card(c, "Staff Count", dept.StaffCount.ToString(), "#3b82f6", "#eff6ff"));
                                    row.ConstantItem(6);
                                    row.RelativeItem().Element(c => Card(c, "Total Likes", dept.Likes.ToString(), "#2563eb", "#eff6ff"));
                                    row.ConstantItem(6);
                                    row.RelativeItem().Element(c => Card(c, "Total Comments", dept.Comments.ToString(), "#0284c7", "#f0f9ff"));
                                    row.ConstantItem(6);
                                    row.RelativeItem().Element(c => Card(c, "Total Shares", dept.Shares.ToString(), "#059669", "#f0fdf4"));
                                    row.ConstantItem(6);
                                    row.RelativeItem().Element(c => Card(c, "Completion Rate", $"{dept.Rate}%", dept.Rate >= 80 ? "#16a34a" : dept.Rate >= 50 ? "#d97706" : "#dc2626", "#f8fafc"));
                                });

                                // Top 5 for this Department
                                if (showRanking && dept.Top5.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(c =>
                                    {
                                        c.Item().PaddingBottom(2).Text($"Top 5 Performing Staff: {dept.Department}").FontSize(9f).Bold().FontColor("#059669");
                                        c.Item().Element(t => RenderDepartmentTop5Table(t, dept.Top5));
                                    });
                                }

                                // Complete Staff Engagement Ticks for this Department
                                if (showStaffTable && dept.AllStaff.Count > 0)
                                {
                                    col.Item().PaddingBottom(6).Column(c =>
                                    {
                                        c.Item().PaddingBottom(2).Text($"Staff Engagement Ticks: {dept.Department}").FontSize(9f).Bold().FontColor("#0f172a");
                                        c.Item().Element(t => RenderDepartmentAllStaffTable(t, dept.AllStaff));
                                    });
                                }
                            }
                        }
                    }

                    // ───── PART 3: DAILY ENGAGEMENT TIMELINE ─────
                    if (showDaily && dailyStats.Count > 0)
                    {
                        col.Item().PageBreak();
                        col.Item().PaddingBottom(4).Background("#f8fafc").Border(1).BorderColor("#cbd5e1").Padding(6).Row(r =>
                        {
                            r.RelativeItem().Text("Daily Engagement Activity Timeline").FontSize(11).Bold().FontColor("#0f172a");
                            r.ConstantItem(260).AlignRight().Text($"Total Days Recorded: {dailyStats.Count}").FontSize(8f).FontColor("#475569");
                        });
                        col.Item().PaddingTop(2).Element(t => DailyTable(t, dailyStats));
                    }
                });

                page.Footer().PaddingTop(4).BorderTop(0.8f).BorderColor("#e2e8f0").Row(r =>
                {
                    r.RelativeItem().Text(t =>
                    {
                        t.Span("SociHR Performance Report").FontSize(7.5f).FontColor("#94a3b8");
                    });
                    r.ConstantItem(220).AlignRight().Text(t =>
                    {
                        t.Span("Page ").FontSize(7.5f).FontColor("#94a3b8");
                        t.CurrentPageNumber().FontSize(7.5f).FontColor("#64748b");
                        t.Span(" of ").FontSize(7.5f).FontColor("#94a3b8");
                        t.TotalPages().FontSize(7.5f).FontColor("#64748b");
                    });
                });
            });
        });

        var bytes = pdf.GeneratePdf();
        return File(bytes, "application/pdf", $"SociHR_Report_{DateTime.Now:yyyyMMdd}.pdf");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, type = ex.GetType().Name, stackTrace = ex.StackTrace });
        }
    }

    private static List<DepartmentStatDto> BuildDepartmentStats(List<StaffPerformanceDto> staffPerf)
    {
        var deptGroups = staffPerf
            .GroupBy(s => string.IsNullOrWhiteSpace(s.Department) || s.Department == "-" ? "No Department" : s.Department)
            .OrderBy(g => g.Key == "No Department" ? "ZZZ" : g.Key)
            .ToList();

        return deptGroups.Select(g =>
        {
            var staffInDept = g.ToList();
            var completed = staffInDept.Sum(s => s.Completed);
            var missed = staffInDept.Sum(s => s.Missed);
            var total = completed + missed;
            var rate = total > 0 ? Math.Round((double)completed / total * 100) : 0;
            var likes = staffInDept.Sum(s => s.Likes);
            var comments = staffInDept.Sum(s => s.Comments);
            var shares = staffInDept.Sum(s => s.Shares);

            var top5InDept = staffInDept
                .OrderByDescending(s => s.CompletionRate)
                .ThenByDescending(s => s.Completed)
                .ThenByDescending(s => s.Total)
                .ThenBy(s => s.FullName)
                .Take(5)
                .Select((s, idx) => new StaffPerformanceDto
                {
                    Rank = idx + 1,
                    StaffID = s.StaffID,
                    FullName = s.FullName,
                    Department = s.Department,
                    Position = s.Position,
                    Status = s.Status,
                    Likes = s.Likes,
                    Comments = s.Comments,
                    Shares = s.Shares,
                    Completed = s.Completed,
                    Missed = s.Missed,
                    Total = s.Total,
                    CompletionRate = s.CompletionRate
                })
                .ToList();

            return new DepartmentStatDto
            {
                Department = g.Key,
                StaffCount = staffInDept.Count,
                Likes = likes,
                Comments = comments,
                Shares = shares,
                Completed = completed,
                Missed = missed,
                Total = total,
                Rate = rate,
                Top5 = top5InDept,
                AllStaff = staffInDept
            };
        }).ToList();
    }

    private void RenderDepartmentSummaryComparisonTable(
        IContainer container,
        List<DepartmentStatDto> items,
        int totalStaff,
        int totalCompleted,
        int totalMissed,
        int totalExpected,
        double overallRate,
        int totalLikes,
        int totalComments,
        int totalShares)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(24); // #
                cd.RelativeColumn(3);  // Unit / Department
                cd.ConstantColumn(55); // Staff Count
                cd.ConstantColumn(50); // Likes
                cd.ConstantColumn(55); // Comments
                cd.ConstantColumn(50); // Shares
                cd.ConstantColumn(60); // Completed
                cd.ConstantColumn(50); // Missed
                cd.ConstantColumn(55); // Expected
                cd.ConstantColumn(55); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#0f172a").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Department / Unit");
                h.Cell().Element(HeaderCell).Text("Staff");
                h.Cell().Element(HeaderCell).Text("Likes 👍");
                h.Cell().Element(HeaderCell).Text("Comments 💬");
                h.Cell().Element(HeaderCell).Text("Shares 🔁");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Missed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var d = items[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                var rateColor = d.Rate >= 80 ? Colors.Green.Darken1 : d.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text((i + 1).ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(d.Department).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.StaffCount.ToString()).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Completed.ToString()).FontColor(Colors.Green.Medium).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Missed.ToString()).FontColor(Colors.Red.Medium).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Total.ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text($"{d.Rate}%").FontColor(rateColor).Bold().FontSize(7.5f);
            }

            static IContainer TotalCell(IContainer c) =>
                c.Background("#f1f5f9").BorderTop(1.5f).BorderColor("#94a3b8").BorderBottom(1.5f).BorderColor("#94a3b8").Padding(3);

            table.Cell().Element(TotalCell).AlignCenter().Text("").FontSize(7.5f);
            table.Cell().Element(TotalCell).Text("OVERALL TOTAL").Bold().FontSize(7.5f).FontColor("#0f172a");
            table.Cell().Element(TotalCell).AlignCenter().Text(totalStaff.ToString()).Bold().FontSize(7.5f).FontColor("#0f172a");
            table.Cell().Element(TotalCell).AlignCenter().Text(totalLikes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalComments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalShares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalCompleted.ToString()).Bold().FontColor(Colors.Green.Darken2).FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalMissed.ToString()).Bold().FontColor(Colors.Red.Darken2).FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalExpected.ToString()).Bold().FontColor("#0f172a").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text($"{overallRate}%").Bold().FontColor(overallRate >= 80 ? Colors.Green.Darken1 : overallRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1).FontSize(7.5f);
        });
    }

    private void RenderDepartmentTop5Table(IContainer container, List<StaffPerformanceDto> top5)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(25); // Rank
                cd.RelativeColumn(3);  // Name
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(50); // Likes
                cd.ConstantColumn(55); // Comments
                cd.ConstantColumn(50); // Shares
                cd.ConstantColumn(60); // Completed
                cd.ConstantColumn(60); // Expected
                cd.ConstantColumn(55); // Rate
            });

            static IContainer HeaderCell(IContainer c) => 
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#059669").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Staff Name");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Position");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            for (int i = 0; i < top5.Count; i++)
            {
                var s = top5[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1 : s.CompletionRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text((i + 1).ToString()).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.FullName).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Position).FontSize(7.5f).FontColor("#475569");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Completed.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Total.ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text($"{s.CompletionRate}%").FontColor(rateColor).Bold().FontSize(7.5f);
            }
        });
    }

    private void RenderDepartmentAllStaffTable(IContainer container, List<StaffPerformanceDto> allStaff)
    {
        var sorted = allStaff
            .OrderByDescending(s => s.CompletionRate)
            .ThenByDescending(s => s.Completed)
            .ThenBy(s => s.FullName)
            .ToList();

        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(25); // Rank
                cd.RelativeColumn(3);  // Name
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(45); // Status
                cd.ConstantColumn(45); // Likes
                cd.ConstantColumn(50); // Comments
                cd.ConstantColumn(45); // Shares
                cd.ConstantColumn(55); // Completed
                cd.ConstantColumn(45); // Missed
                cd.ConstantColumn(55); // Expected
                cd.ConstantColumn(50); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#0f172a").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Staff Name");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Position");
                h.Cell().Element(HeaderCell).Text("Status");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Missed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            for (int i = 0; i < sorted.Count; i++)
            {
                var s = sorted[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1 : s.CompletionRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text((i + 1).ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.FullName).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Position).FontSize(7.5f).FontColor("#475569");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Status).FontSize(7f).FontColor("#64748b");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Completed.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Missed.ToString()).Bold().FontColor(Colors.Red.Medium).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Total.ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text($"{s.CompletionRate}%").FontColor(rateColor).Bold().FontSize(7.5f);
            }
        });
    }

    private void RenderOverallTopStaffTable(IContainer container, List<StaffPerformanceDto> items)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(25); // Rank
                cd.RelativeColumn(3);  // Name
                cd.RelativeColumn(2);  // Dept
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(45); // Likes
                cd.ConstantColumn(50); // Comments
                cd.ConstantColumn(45); // Shares
                cd.ConstantColumn(55); // Completed
                cd.ConstantColumn(55); // Expected
                cd.ConstantColumn(50); // Rate
            });

            static IContainer HeaderCell(IContainer c) => 
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#065f46").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Staff Name");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Department");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Position");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var s = items[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1 : s.CompletionRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text((i + 1).ToString()).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.FullName).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Department).FontSize(7.5f).FontColor("#1e293b");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Position).FontSize(7.5f).FontColor("#475569");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Completed.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Total.ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text($"{s.CompletionRate}%").FontColor(rateColor).Bold().FontSize(7.5f);
            }
        });
    }

    private void RenderOverallBottomStaffTable(IContainer container, List<StaffPerformanceDto> items)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(25); // Rank
                cd.RelativeColumn(3);  // Name
                cd.RelativeColumn(2);  // Dept
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(45); // Likes
                cd.ConstantColumn(50); // Comments
                cd.ConstantColumn(45); // Shares
                cd.ConstantColumn(55); // Completed
                cd.ConstantColumn(55); // Expected
                cd.ConstantColumn(50); // Rate
            });

            static IContainer HeaderCell(IContainer c) => 
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#991b1b").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Staff Name");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Department");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Position");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var s = items[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1 : s.CompletionRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Rank.ToString()).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.FullName).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Department).FontSize(7.5f).FontColor("#1e293b");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(s.Position).FontSize(7.5f).FontColor("#475569");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Completed.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(s.Total.ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text($"{s.CompletionRate}%").FontColor(rateColor).Bold().FontSize(7.5f);
            }
        });
    }

    private void Card(IContainer container, string label, string value, string color, string? bgTint = null)
    {
        container
            .Background(bgTint ?? "#f8fafc")
            .Border(1)
            .BorderColor("#e2e8f0")
            .Row(row =>
            {
                row.ConstantItem(4).Background(color);
                
                row.RelativeItem().Padding(7).Column(c =>
                {
                    c.Item().Text(label.ToUpper()).FontSize(7f).FontColor("#64748b").Bold();
                    c.Item().PaddingTop(2).Text(value).FontSize(13f).Bold().FontColor(color);
                });
            });
    }

    private void PlatformTable(IContainer container, List<PlatformStatDto> items)
    {
        var totalCompleted = items.Sum(p => p.Completed);
        var totalMissed = items.Sum(p => p.Missed);
        var totalExpected = totalCompleted + totalMissed;
        var totalRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100) : 0;

        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3);  // Platform
                cd.ConstantColumn(85); // Completed
                cd.ConstantColumn(85); // Missed
                cd.ConstantColumn(85); // Expected
                cd.ConstantColumn(75); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#0f172a").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).AlignLeft().Text("Platform");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Missed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var p = items[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = p.Rate >= 80 ? Colors.Green.Darken1 : p.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                table.Cell().Element(c => DataCell(c, bgColor)).Text(p.Platform).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(p.Completed.ToString()).FontColor(Colors.Green.Medium).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(p.Missed.ToString()).FontColor(Colors.Red.Medium).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(p.Total.ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text($"{p.Rate}%").FontColor(rateColor).Bold().FontSize(7.5f);
            }

            static IContainer TotalCell(IContainer c) =>
                c.Background("#f1f5f9").BorderTop(1.5f).BorderColor("#94a3b8").BorderBottom(1.5f).BorderColor("#94a3b8").Padding(3);

            table.Cell().Element(TotalCell).Text("TOTAL").Bold().FontSize(7.5f).FontColor("#0f172a");
            table.Cell().Element(TotalCell).AlignCenter().Text(totalCompleted.ToString()).Bold().FontColor(Colors.Green.Darken2).FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalMissed.ToString()).Bold().FontColor(Colors.Red.Darken2).FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalExpected.ToString()).Bold().FontColor("#0f172a").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text($"{totalRate}%").Bold().FontColor(totalRate >= 80 ? Colors.Green.Darken1 : totalRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1).FontSize(7.5f);
        });
    }

    private void CompanyTable(IContainer container, List<CompanyStatDto> items)
    {
        var totalLikes = items.Sum(c => c.Likes);
        var totalComments = items.Sum(c => c.Comments);
        var totalShares = items.Sum(c => c.Shares);
        var totalCompleted = items.Sum(c => c.Completed);
        var totalMissed = items.Sum(c => c.Missed);
        var totalExpected = totalCompleted + totalMissed;
        var totalRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100) : 0;

        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3);  // Company
                cd.ConstantColumn(50); // Likes
                cd.ConstantColumn(55); // Comments
                cd.ConstantColumn(50); // Shares
                cd.ConstantColumn(60); // Completed
                cd.ConstantColumn(50); // Missed
                cd.ConstantColumn(55); // Expected
                cd.ConstantColumn(55); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#0f172a").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).AlignLeft().Text("Company");
                h.Cell().Element(HeaderCell).Text("Likes 👍");
                h.Cell().Element(HeaderCell).Text("Comments 💬");
                h.Cell().Element(HeaderCell).Text("Shares 🔁");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Missed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var co = items[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = co.Rate >= 80 ? Colors.Green.Darken1 : co.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                table.Cell().Element(c => DataCell(c, bgColor)).Text(co.Company).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(co.Likes.ToString()).FontColor("#2563eb").Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(co.Comments.ToString()).FontColor("#0284c7").Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(co.Shares.ToString()).FontColor("#059669").Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(co.Completed.ToString()).FontColor(Colors.Green.Medium).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(co.Missed.ToString()).FontColor(Colors.Red.Medium).Bold().FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(co.Total.ToString()).FontSize(7.5f);
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text($"{co.Rate}%").FontColor(rateColor).Bold().FontSize(7.5f);
            }

            static IContainer TotalCell(IContainer c) =>
                c.Background("#f1f5f9").BorderTop(1.5f).BorderColor("#94a3b8").BorderBottom(1.5f).BorderColor("#94a3b8").Padding(3);

            table.Cell().Element(TotalCell).Text("TOTAL").Bold().FontSize(7.5f).FontColor("#0f172a");
            table.Cell().Element(TotalCell).AlignCenter().Text(totalLikes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalComments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalShares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalCompleted.ToString()).Bold().FontColor(Colors.Green.Darken2).FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalMissed.ToString()).Bold().FontColor(Colors.Red.Darken2).FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text(totalExpected.ToString()).Bold().FontColor("#0f172a").FontSize(7.5f);
            table.Cell().Element(TotalCell).AlignCenter().Text($"{totalRate}%").Bold().FontColor(totalRate >= 80 ? Colors.Green.Darken1 : totalRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1).FontSize(7.5f);
        });
    }

    private void DailyTable(IContainer container, List<DailyStatDto> items)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(2);  // Date
                cd.ConstantColumn(75); // Sessions
                cd.ConstantColumn(85); // Completed
                cd.ConstantColumn(85); // Missed
                cd.ConstantColumn(85); // Expected
                cd.ConstantColumn(75); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background("#1e1b4b").Padding(5);

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("Date");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Sessions");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Completed");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Missed");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Expected");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Rate (%)");
            });

            for (int i = 0; i < items.Count; i++)
            {
                var d = items[i];
                var bgColor = i % 2 == 1 ? "#f8fafc" : "#ffffff";

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(4);

                table.Cell().Element(c => DataCell(c, bgColor)).Text(d.Date.ToString("dd MMMM yyyy")).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.SessionCount.ToString()).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Completed.ToString()).FontColor(Colors.Green.Medium).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Missed.ToString()).FontColor(Colors.Red.Medium).Bold();
                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(d.Total.ToString());

                // Heatmap-style tinted cell for Rate
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

    private async Task<List<PlatformStatDto>> GetPlatformStatsAsync(DateTime? from, DateTime? to, string? deptName = null)
    {
        var query = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Session)
            .Include(e => e.Staff)
            .AsQueryable();

        if (deptName != null)
            query = query.Where(e => e.Staff!.Department == deptName);

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

    private async Task<List<CompanyStatDto>> GetCompanyStatsAsync(DateTime? from, DateTime? to, string? deptName = null)
    {
        var companies = await _db.Companies
            .OrderBy(c => c.CompanyName)
            .ToListAsync();

        var query = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Session)
            .Include(e => e.Staff)
            .Where(e => e.Post!.CompanyID != null)
            .AsQueryable();

        if (deptName != null)
            query = query.Where(e => e.Staff!.Department == deptName);

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
            var likes = companyEngagements.Count(e => e.IsLiked);
            var comments = companyEngagements.Count(e => e.IsCommented);
            var shares = companyEngagements.Count(e => e.IsShared);
            var completed = companyEngagements.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
            var total = companyEngagements.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
            var missed = total - completed;
            return new CompanyStatDto
            {
                Company = company.CompanyName,
                Likes = likes,
                Comments = comments,
                Shares = shares,
                Completed = completed,
                Missed = missed,
                Total = total,
                Rate = total > 0 ? Math.Round((double)completed / total * 100) : 0
            };
        }).ToList();
    }

    private async Task<List<DailyStatDto>> GetDailyStatsAsync(DateTime? from, DateTime? to, string? deptName = null)
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

        var engQuery = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Staff)
            .Where(e => sessionIds.Contains(e.SessionID));

        if (deptName != null)
            engQuery = engQuery.Where(e => e.Staff!.Department == deptName);

        var engagements = await engQuery.ToListAsync();

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

    private async Task<List<PlatformStatDto>> GetPlatformStatsMultiDeptAsync(DateTime? from, DateTime? to, List<string>? deptFilter = null)
    {
        var query = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Session)
            .Include(e => e.Staff)
            .AsQueryable();

        if (deptFilter != null && deptFilter.Count > 0)
            query = query.Where(e => deptFilter.Contains(e.Staff!.Department));

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

    private async Task<List<CompanyStatDto>> GetCompanyStatsMultiDeptAsync(DateTime? from, DateTime? to, List<string>? deptFilter = null)
    {
        var companies = await _db.Companies
            .OrderBy(c => c.CompanyName)
            .ToListAsync();

        var query = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Session)
            .Include(e => e.Staff)
            .Where(e => e.Post!.CompanyID != null)
            .AsQueryable();

        if (deptFilter != null && deptFilter.Count > 0)
            query = query.Where(e => deptFilter.Contains(e.Staff!.Department));

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
            var likes = companyEngagements.Count(e => e.IsLiked);
            var comments = companyEngagements.Count(e => e.IsCommented);
            var shares = companyEngagements.Count(e => e.IsShared);
            var completed = companyEngagements.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
            var total = companyEngagements.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
            var missed = total - completed;
            return new CompanyStatDto
            {
                Company = company.CompanyName,
                Likes = likes,
                Comments = comments,
                Shares = shares,
                Completed = completed,
                Missed = missed,
                Total = total,
                Rate = total > 0 ? Math.Round((double)completed / total * 100) : 0
            };
        }).ToList();
    }

    private async Task<List<DailyStatDto>> GetDailyStatsMultiDeptAsync(DateTime? from, DateTime? to, List<string>? deptFilter = null)
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

        var engQuery = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Include(e => e.Staff)
            .Where(e => sessionIds.Contains(e.SessionID));

        if (deptFilter != null && deptFilter.Count > 0)
            engQuery = engQuery.Where(e => deptFilter.Contains(e.Staff!.Department));

        var engagements = await engQuery.ToListAsync();

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
        if (rd.ActionColumns.Count == 0 || rd.StaffRows.Count == 0) return;

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(16); // #
                columns.ConstantColumn(85); // Staff Name
                columns.ConstantColumn(45); // Dept
                foreach (var _ in rd.ActionColumns)
                    columns.RelativeColumn();
                columns.ConstantColumn(45); // Reason
            });

            table.Header(header =>
            {
                static IContainer HeaderBox(IContainer c, string bg) =>
                    c.Background(bg).Border(1).BorderColor("#cbd5e1").PaddingHorizontal(2).PaddingVertical(2).AlignCenter().AlignMiddle();

                header.Cell().RowSpan(3).Element(c => HeaderBox(c, "#f1f5f9")).Text("#").FontSize(7f).Bold().FontColor("#475569");
                header.Cell().RowSpan(3).Element(c => HeaderBox(c, "#f1f5f9")).Text("Staff Name").FontSize(7f).Bold().FontColor("#475569");
                header.Cell().RowSpan(3).Element(c => HeaderBox(c, "#f1f5f9")).Text("Dept").FontSize(7f).Bold().FontColor("#475569");

                foreach (var coGroup in rd.CompanyGroups)
                {
                    header.Cell().ColumnSpan((uint)coGroup.Span).Element(c => HeaderBox(c, "#dbeafe"))
                        .Text(t => t.Span(coGroup.Name).FontSize(7.5f).Bold().FontColor("#1e40af"));
                }

                header.Cell().RowSpan(3).Element(c => HeaderBox(c, "#fef3c7")).Text("Reason").FontSize(7f).Bold().FontColor("#92400e");

                foreach (var platGroup in rd.PlatformGroups)
                {
                    var cell = header.Cell().ColumnSpan((uint)platGroup.Span).Element(c => HeaderBox(c, "#e0f2fe"));
                    if (!string.IsNullOrEmpty(platGroup.PostLink))
                        cell.Hyperlink(platGroup.PostLink).Text(t => t.Span(platGroup.PlatformName).FontSize(6.5f).Bold().FontColor("#0369a1").Underline());
                    else
                        cell.Text(t => t.Span(platGroup.PlatformName).FontSize(6.5f).Bold().FontColor("#0369a1"));
                }

                foreach (var ac in rd.ActionColumns)
                {
                    var shortAction = ac.Action.ToLower() switch
                    {
                        "like" => "L",
                        "comment" => "C",
                        "share" => "S",
                        _ => ac.ActionLabel.Length > 3 ? ac.ActionLabel[..3] : ac.ActionLabel
                    };

                    header.Cell().Element(c => HeaderBox(c, "#f0fdf4"))
                        .Text(t => t.Span(shortAction).FontSize(6f).Bold().FontColor("#15803d"));
                }
            });

            int rowNum = 1;
            foreach (var staffRow in rd.StaffRows)
            {
                var bgColor = rowNum % 2 == 0 ? "#f8fafc" : "#ffffff";

                static IContainer DataCell(IContainer c, string bg) =>
                    c.Background(bg).Border(1).BorderColor("#cbd5e1").PaddingHorizontal(2).PaddingVertical(2).AlignMiddle();

                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(rowNum.ToString()).FontSize(6.5f).FontColor("#64748b");
                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.StaffName).FontSize(6.5f).Bold().FontColor("#1e293b"));
                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Department).FontSize(6.5f).FontColor("#475569"));

                static IContainer ActionCell(IContainer c, string bg) =>
                    c.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(1).AlignMiddle();

                for (int i = 0; i < staffRow.EngagementValues.Count; i++)
                {
                    var value = staffRow.EngagementValues[i];
                    var cell = table.Cell().Element(c => ActionCell(c, bgColor)).AlignCenter();
                    if (value)
                    {
                        cell.AlignCenter().AlignMiddle()
                            .Width(9).Height(9)
                            .Background("#10b981")
                            .Border(1).BorderColor("#059669")
                            .Padding(1.5f)
                            .Svg("""<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>""");
                    }
                    else
                    {
                        cell.Text("");
                    }
                }

                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Reason ?? "").FontSize(5.5f).FontColor("#475569"));
                rowNum++;
            }
        });
    }

    // ─── Unit-scoped monitoring matrix ─────────────────────────────
    // Builds a combined monitoring matrix for one unit (department) across all
    // date-scoped sessions, so each unit gets its own consolidated matrix.
    private static MonitoringSessionController.ReportData BuildUnitMonitoringData(
        List<Guid> unitStaffIds,
        List<Engagement> monitoringEngagements)
    {
        var filtered = monitoringEngagements
            .Where(e => e.Staff != null && unitStaffIds.Contains(e.StaffID))
            .ToList();

        // Reuse the existing batch builder (session field is informational here;
        // the matrix is aggregated across every session for this unit).
        MonitoringSession? placeholder = null;
        var data = MonitoringSessionController.BuildReportData(placeholder, filtered);
        data.SessionDate = DateOnly.FromDateTime(DateTime.Now);
        data.IsUnit = true;
        return data;
    }

    private static void RenderCompanyBreakdownTable(IContainer container, List<MonitoringSessionController.CompanyEngagementStat> stats)
    {
        container.Table(ct =>
        {
            ct.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3);  // Company
                cd.ConstantColumn(65); // Likes
                cd.ConstantColumn(65); // Comments
                cd.ConstantColumn(65); // Shares
                cd.ConstantColumn(75); // Completed
                cd.ConstantColumn(75); // Expected
                cd.ConstantColumn(65); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#0f172a").Padding(3).AlignCenter();

            ct.Header(h =>
            {
                h.Cell().Element(HeaderCell).AlignLeft().Text("Company");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            int cRowIdx = 0;
            foreach (var cs in stats)
            {
                var cBg = cRowIdx++ % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rate = cs.Rate;
                var rateColor = rate >= 80 ? Colors.Green.Darken1 : rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer CellStyle(IContainer c, string bg) =>
                    c.Background(bg).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                ct.Cell().Element(c => CellStyle(c, cBg)).Text(cs.CompanyName).Bold().FontSize(7.5f);
                ct.Cell().Element(c => CellStyle(c, cBg)).AlignCenter().Text(cs.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                ct.Cell().Element(c => CellStyle(c, cBg)).AlignCenter().Text(cs.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                ct.Cell().Element(c => CellStyle(c, cBg)).AlignCenter().Text(cs.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                ct.Cell().Element(c => CellStyle(c, cBg)).AlignCenter().Text(cs.CompletedTicks.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
                ct.Cell().Element(c => CellStyle(c, cBg)).AlignCenter().Text(cs.TotalExpectedTicks.ToString()).FontSize(7.5f);
                ct.Cell().Element(c => CellStyle(c, cBg)).AlignCenter().Text($"{rate}%").Bold().FontColor(rateColor).FontSize(7.5f);
            }

            // Total / Summary Row
            var sumLikes = stats.Sum(c => c.Likes);
            var sumComments = stats.Sum(c => c.Comments);
            var sumShares = stats.Sum(c => c.Shares);
            var sumCompleted = stats.Sum(c => c.CompletedTicks);
            var sumExpected = stats.Sum(c => c.TotalExpectedTicks);
            var overallCompRate = sumExpected > 0 ? Math.Round((double)sumCompleted / sumExpected * 100) : 0;
            var overallCompColor = overallCompRate >= 80 ? Colors.Green.Darken1 : overallCompRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

            static IContainer TotalCellStyle(IContainer c) =>
                c.Background("#f1f5f9").BorderTop(1.5f).BorderColor("#94a3b8").BorderBottom(1.5f).BorderColor("#94a3b8").Padding(3);

            ct.Cell().Element(TotalCellStyle).Text("Total").Bold().FontSize(7.5f).FontColor("#0f172a");
            ct.Cell().Element(TotalCellStyle).AlignCenter().Text(sumLikes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
            ct.Cell().Element(TotalCellStyle).AlignCenter().Text(sumComments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
            ct.Cell().Element(TotalCellStyle).AlignCenter().Text(sumShares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
            ct.Cell().Element(TotalCellStyle).AlignCenter().Text(sumCompleted.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
            ct.Cell().Element(TotalCellStyle).AlignCenter().Text(sumExpected.ToString()).Bold().FontSize(7.5f);
            ct.Cell().Element(TotalCellStyle).AlignCenter().Text($"{overallCompRate}%").Bold().FontColor(overallCompColor).FontSize(7.5f);
        });
    }

    private static void RenderPlatformBreakdownTable(IContainer container, List<MonitoringSessionController.PlatformEngagementStat> stats)
    {
        container.Table(pt =>
        {
            pt.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3);  // Platform
                cd.ConstantColumn(65); // Likes
                cd.ConstantColumn(65); // Comments
                cd.ConstantColumn(65); // Shares
                cd.ConstantColumn(75); // Completed
                cd.ConstantColumn(75); // Expected
                cd.ConstantColumn(65); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#1e293b").Padding(3).AlignCenter();

            pt.Header(h =>
            {
                h.Cell().Element(HeaderCell).AlignLeft().Text("Platform");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            int pRowIdx = 0;
            foreach (var ps in stats)
            {
                var pBg = pRowIdx++ % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rate = ps.Rate;
                var rateColor = rate >= 80 ? Colors.Green.Darken1 : rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer CellStyle(IContainer c, string bg) =>
                    c.Background(bg).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                pt.Cell().Element(c => CellStyle(c, pBg)).Text(ps.PlatformName).Bold().FontSize(7.5f);
                pt.Cell().Element(c => CellStyle(c, pBg)).AlignCenter().Text(ps.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                pt.Cell().Element(c => CellStyle(c, pBg)).AlignCenter().Text(ps.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                pt.Cell().Element(c => CellStyle(c, pBg)).AlignCenter().Text(ps.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                pt.Cell().Element(c => CellStyle(c, pBg)).AlignCenter().Text(ps.CompletedTicks.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
                pt.Cell().Element(c => CellStyle(c, pBg)).AlignCenter().Text(ps.TotalExpectedTicks.ToString()).FontSize(7.5f);
                pt.Cell().Element(c => CellStyle(c, pBg)).AlignCenter().Text($"{rate}%").Bold().FontColor(rateColor).FontSize(7.5f);
            }

            // Total / Summary Row
            var pSumLikes = stats.Sum(p => p.Likes);
            var pSumComments = stats.Sum(p => p.Comments);
            var pSumShares = stats.Sum(p => p.Shares);
            var pSumCompleted = stats.Sum(p => p.CompletedTicks);
            var pSumExpected = stats.Sum(p => p.TotalExpectedTicks);
            var pOverallRate = pSumExpected > 0 ? Math.Round((double)pSumCompleted / pSumExpected * 100) : 0;
            var pOverallColor = pOverallRate >= 80 ? Colors.Green.Darken1 : pOverallRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

            static IContainer TotalCellStyle(IContainer c) =>
                c.Background("#f1f5f9").BorderTop(1.5f).BorderColor("#94a3b8").BorderBottom(1.5f).BorderColor("#94a3b8").Padding(3);

            pt.Cell().Element(TotalCellStyle).Text("Total").Bold().FontSize(7.5f).FontColor("#0f172a");
            pt.Cell().Element(TotalCellStyle).AlignCenter().Text(pSumLikes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
            pt.Cell().Element(TotalCellStyle).AlignCenter().Text(pSumComments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
            pt.Cell().Element(TotalCellStyle).AlignCenter().Text(pSumShares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
            pt.Cell().Element(TotalCellStyle).AlignCenter().Text(pSumCompleted.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
            pt.Cell().Element(TotalCellStyle).AlignCenter().Text(pSumExpected.ToString()).Bold().FontSize(7.5f);
            pt.Cell().Element(TotalCellStyle).AlignCenter().Text($"{pOverallRate}%").Bold().FontColor(pOverallColor).FontSize(7.5f);
        });
    }

    private static void RenderSessionTop5Table(IContainer container, List<MonitoringSessionController.StaffRowData> staffRows)
    {
        var top5 = staffRows
            .OrderByDescending(s => s.CompletionRate)
            .ThenByDescending(s => s.CompletedTicks)
            .Take(5)
            .ToList();
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(25); // Rank
                cd.RelativeColumn(3);  // Staff Name
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(50); // Likes
                cd.ConstantColumn(55); // Comments
                cd.ConstantColumn(50); // Shares
                cd.ConstantColumn(65); // Completed
                cd.ConstantColumn(65); // Expected
                cd.ConstantColumn(55); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#059669").Padding(3).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Staff Name");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Position");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            int rIdx = 0;
            foreach (var s in top5)
            {
                var bg = rIdx++ % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1 : s.CompletionRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer CellStyle(IContainer c, string bg) =>
                    c.Background(bg).BorderBottom(1).BorderColor("#e2e8f0").Padding(3);

                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(rIdx.ToString()).Bold().FontSize(7.5f);
                table.Cell().Element(c => CellStyle(c, bg)).Text(s.StaffName).Bold().FontSize(7.5f).FontColor("#0f172a");
                table.Cell().Element(c => CellStyle(c, bg)).Text(s.Position).FontSize(7.5f).FontColor("#475569");
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(7.5f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(7.5f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.Shares.ToString()).Bold().FontColor("#059669").FontSize(7.5f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.CompletedTicks.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(7.5f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.TotalTicks.ToString()).FontSize(7.5f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text($"{s.CompletionRate}%").Bold().FontColor(rateColor).FontSize(7.5f);
            }
        });
    }

    private static void RenderSessionStaffTickTable(IContainer container, List<MonitoringSessionController.StaffRowData> staffRows)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(25); // #
                cd.RelativeColumn(3);  // Staff Name
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(50); // Likes
                cd.ConstantColumn(55); // Comments
                cd.ConstantColumn(50); // Shares
                cd.ConstantColumn(65); // Completed
                cd.ConstantColumn(65); // Expected
                cd.ConstantColumn(55); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontSize(8f).FontColor(Colors.White)).Background("#0f172a").Padding(4).AlignCenter();

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Staff Name");
                h.Cell().Element(HeaderCell).AlignLeft().Text("Position");
                h.Cell().Element(HeaderCell).Text("Likes");
                h.Cell().Element(HeaderCell).Text("Comments");
                h.Cell().Element(HeaderCell).Text("Shares");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate (%)");
            });

            int rIdx = 0;
            foreach (var s in staffRows)
            {
                var bg = rIdx++ % 2 == 1 ? "#f8fafc" : "#ffffff";
                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1 : s.CompletionRate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;

                static IContainer CellStyle(IContainer c, string bg) =>
                    c.Background(bg).BorderBottom(1).BorderColor("#e2e8f0").Padding(4);

                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(rIdx.ToString()).FontSize(8f);
                table.Cell().Element(c => CellStyle(c, bg)).Text(s.StaffName).Bold().FontSize(8f).FontColor("#0f172a");
                table.Cell().Element(c => CellStyle(c, bg)).Text(s.Position).FontSize(8f).FontColor("#475569");
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.Likes.ToString()).Bold().FontColor("#2563eb").FontSize(8f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.Comments.ToString()).Bold().FontColor("#0284c7").FontSize(8f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.Shares.ToString()).Bold().FontColor("#059669").FontSize(8f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.CompletedTicks.ToString()).Bold().FontColor(Colors.Green.Medium).FontSize(8f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text(s.TotalTicks.ToString()).FontSize(8f);
                table.Cell().Element(c => CellStyle(c, bg)).AlignCenter().Text($"{s.CompletionRate}%").Bold().FontColor(rateColor).FontSize(8f);
            }
        });
    }

    // ─── Per-unit staff performance table (PDF) ─────────────────────
    private void UnitStaffDetailTable(IContainer container, DepartmentStatDto dept)
    {
        var sorted = dept.AllStaff
            .OrderByDescending(s => s.CompletionRate)
            .ThenByDescending(s => s.Completed)
            .ToList();

        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(30); // Unit Rank #
                cd.RelativeColumn(3);  // Name
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(70); // Completed
                cd.ConstantColumn(70); // Expected
                cd.ConstantColumn(60); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background("#7c3aed").Padding(4);

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).Text("#");
                h.Cell().Element(HeaderCell).Text("Name");
                h.Cell().Element(HeaderCell).Text("Position");
                h.Cell().Element(HeaderCell).Text("Completed");
                h.Cell().Element(HeaderCell).Text("Expected");
                h.Cell().Element(HeaderCell).Text("Rate");
            });

            bool alternate = false;
            for (int si = 0; si < sorted.Count; si++)
            {
                var s = sorted[si];
                var bg = alternate ? Colors.Grey.Lighten5 : Colors.White;
                alternate = !alternate;

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).Border(1).BorderColor(Colors.Grey.Lighten3).Padding(4);

                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1
                             : s.CompletionRate >= 50 ? Colors.Orange.Darken2
                             : Colors.Red.Darken1;

                table.Cell().Element(c => DataCell(c, bg)).Text((si + 1).ToString());
                table.Cell().Element(c => DataCell(c, bg)).Text(s.FullName).Bold();
                table.Cell().Element(c => DataCell(c, bg)).Text(s.Position);
                table.Cell().Element(c => DataCell(c, bg)).Text(s.Completed.ToString());
                table.Cell().Element(c => DataCell(c, bg)).Text(s.Total.ToString());
                table.Cell().Element(c => DataCell(c, bg)).Text($"{s.CompletionRate}%").FontColor(rateColor).Bold();
            }
        });
    }

    // ─── PDF: overall all-staff master table (all units combined) ───
    private void OverallAllStaffTable(IContainer container, List<StaffPerformanceDto> staffPerf)
    {
        var sorted = staffPerf
            .OrderByDescending(s => s.CompletionRate)
            .ThenByDescending(s => s.Completed)
            .ToList();

        container.Table(table =>
        {
            table.ColumnsDefinition(cd =>
            {
                cd.ConstantColumn(35); // Overall Rank #
                cd.RelativeColumn(3);  // Name
                cd.RelativeColumn(2);  // Department / Unit
                cd.RelativeColumn(2);  // Position
                cd.ConstantColumn(65); // Completed
                cd.ConstantColumn(65); // Expected
                cd.ConstantColumn(60); // Rate
            });

            static IContainer HeaderCell(IContainer c) =>
                c.DefaultTextStyle(t => t.Bold().FontColor(Colors.White)).Background("#1e1b4b").Padding(5);

            table.Header(h =>
            {
                h.Cell().Element(HeaderCell).AlignCenter().Text("#");
                h.Cell().Element(HeaderCell).Text("Staff Name");
                h.Cell().Element(HeaderCell).Text("Unit / Dept");
                h.Cell().Element(HeaderCell).Text("Position");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Completed");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Expected");
                h.Cell().Element(HeaderCell).AlignCenter().Text("Rate (%)");
            });

            for (int i = 0; i < sorted.Count; i++)
            {
                var s = sorted[i];
                var bg = i % 2 == 1 ? "#f8fafc" : "#ffffff";

                static IContainer DataCell(IContainer c, string color) =>
                    c.Background(color).BorderBottom(1).BorderColor("#e2e8f0").Padding(4);

                var rateColor = s.CompletionRate >= 80 ? Colors.Green.Darken1
                             : s.CompletionRate >= 50 ? Colors.Orange.Darken2
                             : Colors.Red.Darken1;

                table.Cell().Element(c => DataCell(c, bg)).AlignCenter().Text((i + 1).ToString()).Bold();
                table.Cell().Element(c => DataCell(c, bg)).Text(s.FullName).Bold();
                table.Cell().Element(c => DataCell(c, bg)).Text(s.Department);
                table.Cell().Element(c => DataCell(c, bg)).Text(s.Position);
                table.Cell().Element(c => DataCell(c, bg)).AlignCenter().Text(s.Completed.ToString()).FontColor(Colors.Green.Medium).Bold();
                table.Cell().Element(c => DataCell(c, bg)).AlignCenter().Text(s.Total.ToString());
                table.Cell().Element(c => DataCell(c, bg)).AlignCenter().Text($"{s.CompletionRate}%").FontColor(rateColor).Bold();
            }
        });
    }
}

public class DepartmentStatDto
{
    public string Department { get; set; } = "No Department";
    public int StaffCount { get; set; }
    public int Likes { get; set; }
    public int Comments { get; set; }
    public int Shares { get; set; }
    public int Completed { get; set; }
    public int Missed { get; set; }
    public int Total { get; set; }
    public double Rate { get; set; }
    public List<StaffPerformanceDto> Top5 { get; set; } = new();
    public List<StaffPerformanceDto> AllStaff { get; set; } = new();
}

public class StaffPerformanceDto
{
    public int Rank { get; set; }
    public Guid StaffID { get; set; }
    public string FullName { get; set; } = "";
    public string Department { get; set; } = "No Department";
    public string Position { get; set; } = "Staff";
    public string Status { get; set; } = "Active";
    public int Likes { get; set; }
    public int Comments { get; set; }
    public int Shares { get; set; }
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
    public int Likes { get; set; }
    public int Comments { get; set; }
    public int Shares { get; set; }
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
    bool IncludeStaffPosition = true,
    List<string>? Departments = null
);
