using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Helpers;
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
        var overallRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;

        var platformStats = await GetPlatformStatsAsync(from, to);
        var companyStats = await GetCompanyStatsAsync(from, to);
        var dailyStats = await GetDailyStatsAsync(from, to);

        var dateRange = $"{from?.ToString("dd/MM/yyyy") ?? "All"} - {to?.ToString("dd/MM/yyyy") ?? "All"}";

        using var workbook = new XLWorkbook();
        
        // Sheet 1: Summary & Rankings
        var wsSummary = workbook.Worksheets.Add("Summary & Rankings");
        wsSummary.Cell(1, 1).Value = "SociHR — Performance & Engagement Summary";
        wsSummary.Cell(1, 1).Style.Font.Bold = true;
        wsSummary.Cell(1, 1).Style.Font.FontSize = 16;
        wsSummary.Cell(2, 1).Value = $"Period: {dateRange}";
        wsSummary.Cell(3, 1).Value = $"Generated: {DateTime.Now:dd/MM/yyyy HH:mm}  •  Crafted by @syaakiirr";

        // Summary KPI headers
        var kpiHeaders = new[] { "Total Staff", "Total Completed Ticks", "Total Missed Ticks", "Total Expected Ticks", "Overall Rate" };
        for (int i = 0; i < kpiHeaders.Length; i++)
        {
            var cell = wsSummary.Cell(5, i + 1);
            cell.Value = kpiHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#f3f4f6");
        }

        wsSummary.Cell(6, 1).Value = staffPerf.Count;
        wsSummary.Cell(6, 2).Value = totalCompleted;
        wsSummary.Cell(6, 3).Value = totalMissed;
        wsSummary.Cell(6, 4).Value = totalExpected;
        wsSummary.Cell(6, 5).Value = $"{overallRate}%";
        for (int i = 1; i <= 5; i++) wsSummary.Cell(6, i).Style.Font.Bold = true;

        // Top Performers Table
        wsSummary.Cell(8, 1).Value = "Top Performing Staff (Best 10)";
        wsSummary.Cell(8, 1).Style.Font.Bold = true;
        wsSummary.Cell(8, 1).Style.Font.FontSize = 12;
        wsSummary.Cell(8, 1).Style.Font.FontColor = XLColor.FromHtml("#16a34a");

        var rankHeaders = new[] { "Rank", "Name", "Department", "Position", "Completed Ticks", "Expected Ticks", "Rate (%)" };
        for (int i = 0; i < rankHeaders.Length; i++)
        {
            var cell = wsSummary.Cell(9, i + 1);
            cell.Value = rankHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#16a34a");
            cell.Style.Font.FontColor = XLColor.White;
        }

        var top10 = staffPerf.Take(10).ToList();
        for (int i = 0; i < top10.Count; i++)
        {
            var row = 10 + i;
            wsSummary.Cell(row, 1).Value = top10[i].Rank;
            wsSummary.Cell(row, 2).Value = top10[i].FullName;
            wsSummary.Cell(row, 3).Value = top10[i].Department;
            wsSummary.Cell(row, 4).Value = top10[i].Position;
            wsSummary.Cell(row, 5).Value = top10[i].Completed;
            wsSummary.Cell(row, 6).Value = top10[i].Total;
            wsSummary.Cell(row, 7).Value = $"{top10[i].CompletionRate}%";
        }

        // Underperformers Table
        var startBottomRow = 10 + Math.Max(top10.Count, 1) + 2;
        wsSummary.Cell(startBottomRow, 1).Value = "Least Performing Staff (Worst 10)";
        wsSummary.Cell(startBottomRow, 1).Style.Font.Bold = true;
        wsSummary.Cell(startBottomRow, 1).Style.Font.FontSize = 12;
        wsSummary.Cell(startBottomRow, 1).Style.Font.FontColor = XLColor.FromHtml("#dc2626");

        for (int i = 0; i < rankHeaders.Length; i++)
        {
            var cell = wsSummary.Cell(startBottomRow + 1, i + 1);
            cell.Value = rankHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#dc2626");
            cell.Style.Font.FontColor = XLColor.White;
        }

        var bottom10 = staffPerf.AsEnumerable().Reverse().Take(10).Reverse().ToList();
        for (int i = 0; i < bottom10.Count; i++)
        {
            var row = startBottomRow + 2 + i;
            wsSummary.Cell(row, 1).Value = bottom10[i].Rank;
            wsSummary.Cell(row, 2).Value = bottom10[i].FullName;
            wsSummary.Cell(row, 3).Value = bottom10[i].Department;
            wsSummary.Cell(row, 4).Value = bottom10[i].Position;
            wsSummary.Cell(row, 5).Value = bottom10[i].Completed;
            wsSummary.Cell(row, 6).Value = bottom10[i].Total;
            wsSummary.Cell(row, 7).Value = $"{bottom10[i].CompletionRate}%";
        }

        wsSummary.Columns().AdjustToContents();

        // Sheet 2: All Staff Details
        var wsDetails = workbook.Worksheets.Add("All Staff Performance");
        var detailsHeaders = new[] { "Rank", "Name", "Department", "Position", "Status", "Completed Ticks", "Missed Ticks", "Expected Ticks", "Completion Rate (%)" };
        for (int i = 0; i < detailsHeaders.Length; i++)
        {
            var cell = wsDetails.Cell(1, i + 1);
            cell.Value = detailsHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#7c3aed");
            cell.Style.Font.FontColor = XLColor.White;
        }

        for (int i = 0; i < staffPerf.Count; i++)
        {
            var row = i + 2;
            wsDetails.Cell(row, 1).Value = staffPerf[i].Rank;
            wsDetails.Cell(row, 2).Value = staffPerf[i].FullName;
            wsDetails.Cell(row, 3).Value = staffPerf[i].Department;
            wsDetails.Cell(row, 4).Value = staffPerf[i].Position;
            wsDetails.Cell(row, 5).Value = staffPerf[i].Status;
            wsDetails.Cell(row, 6).Value = staffPerf[i].Completed;
            wsDetails.Cell(row, 7).Value = staffPerf[i].Missed;
            wsDetails.Cell(row, 8).Value = staffPerf[i].Total;
            wsDetails.Cell(row, 9).Value = $"{staffPerf[i].CompletionRate}%";
        }

        wsDetails.Columns().AdjustToContents();

        // Sheet 3: Engagement Ticks by Platform & Company
        var wsBreakdown = workbook.Worksheets.Add("Platform & Company");
        wsBreakdown.Cell(1, 1).Value = "Engagement Ticks by Platform";
        wsBreakdown.Cell(1, 1).Style.Font.Bold = true;
        wsBreakdown.Cell(1, 1).Style.Font.FontSize = 12;
        wsBreakdown.Cell(1, 1).Style.Font.FontColor = XLColor.FromHtml("#7c3aed");

        var platformHeaders = new[] { "Platform", "Completed Ticks", "Missed Ticks", "Expected Ticks", "Rate (%)" };
        for (int i = 0; i < platformHeaders.Length; i++)
        {
            var cell = wsBreakdown.Cell(2, i + 1);
            cell.Value = platformHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#7c3aed");
            cell.Style.Font.FontColor = XLColor.White;
        }
        for (int i = 0; i < platformStats.Count; i++)
        {
            var row = 3 + i;
            wsBreakdown.Cell(row, 1).Value = platformStats[i].Platform;
            wsBreakdown.Cell(row, 2).Value = platformStats[i].Completed;
            wsBreakdown.Cell(row, 3).Value = platformStats[i].Missed;
            wsBreakdown.Cell(row, 4).Value = platformStats[i].Total;
            wsBreakdown.Cell(row, 5).Value = $"{platformStats[i].Rate}%";
        }

        var companySectionRow = 3 + Math.Max(platformStats.Count, 1) + 2;
        wsBreakdown.Cell(companySectionRow, 1).Value = "Engagement Ticks by Company";
        wsBreakdown.Cell(companySectionRow, 1).Style.Font.Bold = true;
        wsBreakdown.Cell(companySectionRow, 1).Style.Font.FontSize = 12;
        wsBreakdown.Cell(companySectionRow, 1).Style.Font.FontColor = XLColor.FromHtml("#7c3aed");

        var companyHeaders = new[] { "Company", "Completed Ticks", "Missed Ticks", "Expected Ticks", "Rate (%)" };
        for (int i = 0; i < companyHeaders.Length; i++)
        {
            var cell = wsBreakdown.Cell(companySectionRow + 1, i + 1);
            cell.Value = companyHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#7c3aed");
            cell.Style.Font.FontColor = XLColor.White;
        }
        for (int i = 0; i < companyStats.Count; i++)
        {
            var row = companySectionRow + 2 + i;
            wsBreakdown.Cell(row, 1).Value = companyStats[i].Company;
            wsBreakdown.Cell(row, 2).Value = companyStats[i].Completed;
            wsBreakdown.Cell(row, 3).Value = companyStats[i].Missed;
            wsBreakdown.Cell(row, 4).Value = companyStats[i].Total;
            wsBreakdown.Cell(row, 5).Value = $"{companyStats[i].Rate}%";
        }

        wsBreakdown.Columns().AdjustToContents();

        // Sheet 4: Daily Engagement (one row per session date within range)
        var wsDaily = workbook.Worksheets.Add("Daily Engagement");
        wsDaily.Cell(1, 1).Value = "Daily Engagement Breakdown";
        wsDaily.Cell(1, 1).Style.Font.Bold = true;
        wsDaily.Cell(1, 1).Style.Font.FontSize = 12;
        wsDaily.Cell(1, 1).Style.Font.FontColor = XLColor.FromHtml("#7c3aed");

        var dailyHeaders = new[] { "Date", "Sessions", "Completed Ticks", "Missed Ticks", "Expected Ticks", "Rate (%)" };
        for (int i = 0; i < dailyHeaders.Length; i++)
        {
            var cell = wsDaily.Cell(2, i + 1);
            cell.Value = dailyHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#7c3aed");
            cell.Style.Font.FontColor = XLColor.White;
        }
        for (int i = 0; i < dailyStats.Count; i++)
        {
            var row = 3 + i;
            wsDaily.Cell(row, 1).Value = dailyStats[i].Date.ToString("dd/MM/yyyy");
            wsDaily.Cell(row, 2).Value = dailyStats[i].SessionCount;
            wsDaily.Cell(row, 3).Value = dailyStats[i].Completed;
            wsDaily.Cell(row, 3).Style.Font.FontColor = XLColor.FromHtml("#16a34a");
            wsDaily.Cell(row, 4).Value = dailyStats[i].Missed;
            wsDaily.Cell(row, 4).Style.Font.FontColor = XLColor.FromHtml("#dc2626");
            wsDaily.Cell(row, 5).Value = dailyStats[i].Total;
            // Store as a real numeric percentage (not text) so it can drive a color-scale,
            // mirroring the dashboard's heatmap (color intensity = completion rate).
            wsDaily.Cell(row, 6).Value = dailyStats[i].Rate / 100.0;
            wsDaily.Cell(row, 6).Style.NumberFormat.Format = "0.0%";
            wsDaily.Cell(row, 6).Style.Font.Bold = true;
        }
        if (dailyStats.Count == 0)
        {
            wsDaily.Cell(3, 1).Value = "No sessions found in this date range.";
        }
        else
        {
            // Heatmap-style color scale on the Rate column, same visual language as the dashboard
            var rateRange = wsDaily.Range(3, 6, 2 + dailyStats.Count, 6);
            rateRange.AddConditionalFormat().ColorScale()
                .LowestValue(XLColor.FromHtml("#eef2ff"))
                .Midpoint(XLCFContentType.Percent, "50", XLColor.FromHtml("#a5b4fc"))
                .HighestValue(XLColor.FromHtml("#6366f1"));
        }

        wsDaily.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Seek(0, SeekOrigin.Begin);

        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"SociHR_Performance_Report_{DateTime.Now:yyyyMMdd}.xlsx");
    }

    // GET /api/reports/pdf?from=2026-01-01&to=2026-12-31
    [HttpGet("pdf")]
    public async Task<IActionResult> ExportPdf([FromQuery] DateTime? from, [FromQuery] DateTime? to)
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
        var overallRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;

        var platformStats = await GetPlatformStatsAsync(from, to);
        var companyStats = await GetCompanyStatsAsync(from, to);
        var dailyStats = await GetDailyStatsAsync(from, to);

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

                    // Top 10 & Bottom 10 side-by-side
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
                            c.Item().Text("Least Performing Staff (Worst 10)").FontSize(11).Bold().FontColor(Colors.Red.Darken2);
                            c.Item().PaddingTop(4).Element(t => MiniTable(t, bottom10, false));
                        });
                    });

                    col.Item().PageBreak();

                    // Engagement Ticks by Platform & Company
                    col.Item().Column(c =>
                    {
                        c.Item().PaddingBottom(6).Text("Engagement Ticks by Platform").FontSize(12).Bold().FontColor("#7c3aed");
                        c.Item().PaddingBottom(20).Element(t => PlatformTable(t, platformStats));

                        c.Item().PaddingBottom(6).Text("Engagement Ticks by Company").FontSize(12).Bold().FontColor("#7c3aed");
                        c.Item().Element(t => CompanyTable(t, companyStats));
                    });

                    col.Item().PageBreak();

                    // Daily Engagement Breakdown
                    col.Item().Column(c =>
                    {
                        c.Item().PaddingBottom(6).Text("Daily Engagement Breakdown").FontSize(12).Bold().FontColor("#7c3aed");
                        if (dailyStats.Count == 0)
                        {
                            c.Item().Text("No sessions found in this date range.").FontColor(Colors.Grey.Medium);
                        }
                        else
                        {
                            c.Item().Element(t => DailyTable(t, dailyStats));
                        }
                    });

                    col.Item().PageBreak();

                    // All Staff Performance Table
                    col.Item().Column(c =>
                    {
                        c.Item().PaddingBottom(6).Text("All Staff Performance Details").FontSize(12).Bold();
                        c.Item().Table(table =>
                        {
                            table.ColumnsDefinition(cd =>
                            {
                                cd.ConstantColumn(40);  // Rank
                                cd.RelativeColumn(3);   // Name
                                cd.RelativeColumn(2);   // Department
                                cd.RelativeColumn(2);   // Position
                                cd.ConstantColumn(70);  // Completed
                                cd.ConstantColumn(70);  // Expected
                                cd.ConstantColumn(60);  // Rate
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
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("SociHR Performance & Engagement Report  •  Page ").FontColor(Colors.Grey.Medium);
                    t.CurrentPageNumber().FontColor(Colors.Grey.Medium);
                    t.Span(" of ").FontColor(Colors.Grey.Medium);
                    t.TotalPages().FontColor(Colors.Grey.Medium);
                });
            });
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
                    Rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0
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
                Rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0
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
