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
            .ToListAsync();

        var engQuery = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .AsQueryable();
        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            engQuery = engQuery.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            engQuery = engQuery.Where(e => e.Session!.SessionDate <= toDate);
        }

        var engagementsList = await engQuery.ToListAsync();

        var staffPerf = staffList.Select(s =>
        {
            var staffEngs = engagementsList.Where(e => e.StaffID == s.StaffID).ToList();
            var completed = staffEngs.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
            var total = staffEngs.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
            var missed = total - completed;
            var rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;
            return new
            {
                s.StaffID,
                FullName = s.FullName,
                Department = s.Department ?? "-",
                Position = s.Position ?? "-",
                Status = s.Status,
                Completed = completed,
                Missed = missed,
                Total = total,
                CompletionRate = rate
            };
        })
        .OrderByDescending(d => d.CompletionRate)
        .ThenByDescending(d => d.Completed)
        .ThenBy(d => d.FullName)
        .Select((d, idx) => new StaffPerformanceDto
        {
            Rank = idx + 1,
            StaffID = d.StaffID,
            FullName = d.FullName,
            Department = d.Department,
            Position = d.Position,
            Status = d.Status,
            Completed = d.Completed,
            Missed = d.Missed,
            Total = d.Total,
            CompletionRate = d.CompletionRate
        })
        .ToList();

        var totalCompleted = staffPerf.Sum(s => s.Completed);
        var totalMissed = staffPerf.Sum(s => s.Missed);
        var totalExpected = totalCompleted + totalMissed;
        var overallRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;

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
        wsSummary.Cell(8, 1).Value = "Top Performing Staff (Best 5)";
        wsSummary.Cell(8, 1).Style.Font.Bold = true;
        wsSummary.Cell(8, 1).Style.Font.FontSize = 12;
        wsSummary.Cell(8, 1).Style.Font.FontColor = XLColor.FromHtml("#16a34a");

        var rankHeaders = new[] { "Rank", "Name", "Department", "Jawatan / Position", "Completed Ticks", "Expected Ticks", "Rate (%)" };
        for (int i = 0; i < rankHeaders.Length; i++)
        {
            var cell = wsSummary.Cell(9, i + 1);
            cell.Value = rankHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#16a34a");
            cell.Style.Font.FontColor = XLColor.White;
        }

        var top5 = staffPerf.Take(5).ToList();
        for (int i = 0; i < top5.Count; i++)
        {
            var row = 10 + i;
            wsSummary.Cell(row, 1).Value = top5[i].Rank;
            wsSummary.Cell(row, 2).Value = top5[i].FullName;
            wsSummary.Cell(row, 3).Value = top5[i].Department;
            wsSummary.Cell(row, 4).Value = top5[i].Position;
            wsSummary.Cell(row, 5).Value = top5[i].Completed;
            wsSummary.Cell(row, 6).Value = top5[i].Total;
            wsSummary.Cell(row, 7).Value = $"{top5[i].CompletionRate}%";
        }

        // Underperformers Table
        var startBottomRow = 17;
        wsSummary.Cell(startBottomRow, 1).Value = "Least Performing Staff (Worst 5)";
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

        var bottom5 = staffPerf.AsEnumerable().Reverse().Take(5).Reverse().ToList();
        for (int i = 0; i < bottom5.Count; i++)
        {
            var row = startBottomRow + 2 + i;
            wsSummary.Cell(row, 1).Value = bottom5[i].Rank;
            wsSummary.Cell(row, 2).Value = bottom5[i].FullName;
            wsSummary.Cell(row, 3).Value = bottom5[i].Department;
            wsSummary.Cell(row, 4).Value = bottom5[i].Position;
            wsSummary.Cell(row, 5).Value = bottom5[i].Completed;
            wsSummary.Cell(row, 6).Value = bottom5[i].Total;
            wsSummary.Cell(row, 7).Value = $"{bottom5[i].CompletionRate}%";
        }

        wsSummary.Columns().AdjustToContents();

        // Sheet 2: All Staff Details
        var wsDetails = workbook.Worksheets.Add("All Staff Performance");
        var detailsHeaders = new[] { "Rank", "Name", "Department", "Jawatan / Position", "Status", "Completed Ticks", "Missed Ticks", "Expected Ticks", "Completion Rate (%)" };
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
            .ToListAsync();

        var engQuery = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .AsQueryable();
        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            engQuery = engQuery.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            engQuery = engQuery.Where(e => e.Session!.SessionDate <= toDate);
        }

        var engagementsList = await engQuery.ToListAsync();

        var staffPerf = staffList.Select(s =>
        {
            var staffEngs = engagementsList.Where(e => e.StaffID == s.StaffID).ToList();
            var completed = staffEngs.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
            var total = staffEngs.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
            var missed = total - completed;
            var rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;
            return new
            {
                s.StaffID,
                FullName = s.FullName,
                Department = s.Department ?? "-",
                Position = s.Position ?? "-",
                Status = s.Status,
                Completed = completed,
                Missed = missed,
                Total = total,
                CompletionRate = rate
            };
        })
        .OrderByDescending(d => d.CompletionRate)
        .ThenByDescending(d => d.Completed)
        .ThenBy(d => d.FullName)
        .Select((d, idx) => new StaffPerformanceDto
        {
            Rank = idx + 1,
            StaffID = d.StaffID,
            FullName = d.FullName,
            Department = d.Department,
            Position = d.Position,
            Status = d.Status,
            Completed = d.Completed,
            Missed = d.Missed,
            Total = d.Total,
            CompletionRate = d.CompletionRate
        })
        .ToList();

        var totalCompleted = staffPerf.Sum(s => s.Completed);
        var totalMissed = staffPerf.Sum(s => s.Missed);
        var totalExpected = totalCompleted + totalMissed;
        var overallRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;

        var dateRange = $"{from?.ToString("dd/MM/yyyy") ?? "All"} - {to?.ToString("dd/MM/yyyy") ?? "All"}";

        var top5 = staffPerf.Take(5).ToList();
        var bottom5 = staffPerf.AsEnumerable().Reverse().Take(5).Reverse().ToList();

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

                    // Top 5 & Bottom 5 side-by-side
                    col.Item().PaddingBottom(20).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Top Performing Staff (Best 5)").FontSize(11).Bold().FontColor(Colors.Green.Darken2);
                            c.Item().PaddingTop(4).Element(t => MiniTable(t, top5, true));
                        });
                        
                        row.ConstantItem(20);
                        
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Least Performing Staff (Worst 5)").FontSize(11).Bold().FontColor(Colors.Red.Darken2);
                            c.Item().PaddingTop(4).Element(t => MiniTable(t, bottom5, false));
                        });
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
