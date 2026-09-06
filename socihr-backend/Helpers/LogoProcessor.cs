using System;
using System.IO;
using SkiaSharp;
using System.Collections.Generic;

namespace socihr_backend.Helpers;

public static class LogoProcessor
{
    public static void ProcessLogo(string inputPath, string[] outputPaths)
    {
        if (!File.Exists(inputPath))
        {
            Console.WriteLine($"[LogoProcessor] File not found: {inputPath}");
            return;
        }

        using var inputStream = File.OpenRead(inputPath);
        using var original = SKBitmap.Decode(inputStream);
        if (original == null)
        {
            Console.WriteLine("[LogoProcessor] Failed to decode image.");
            return;
        }

        int width = original.Width;
        int height = original.Height;

        // Create an RGBA_8888 bitmap with full alpha support
        using var resultBitmap = new SKBitmap(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);

        // Sample corner background color
        var c0 = original.GetPixel(2, 2);
        var c1 = original.GetPixel(width - 3, 2);
        var c2 = original.GetPixel(2, height - 3);
        var c3 = original.GetPixel(width - 3, height - 3);

        float bgR = (c0.Red + c1.Red + c2.Red + c3.Red) / 4f;
        float bgG = (c0.Green + c1.Green + c2.Green + c3.Green) / 4f;
        float bgB = (c0.Blue + c1.Blue + c2.Blue + c3.Blue) / 4f;

        // Perform breadth-first flood fill from borders to identify outer background area
        bool[,] isBackground = new bool[width, height];
        var queue = new Queue<(int x, int y)>();

        void TryEnqueue(int x, int y)
        {
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            if (isBackground[x, y]) return;

            var px = original.GetPixel(x, y);
            // Color distance to background / lightness check
            float dr = px.Red - bgR;
            float dg = px.Green - bgG;
            float db = px.Blue - bgB;
            float dist = MathF.Sqrt(dr * dr + dg * dg + db * db);

            // Also check pure brightness (white/near-white)
            float brightness = (px.Red + px.Green + px.Blue) / 3f;

            if (dist < 40f || (brightness > 242 && dist < 70f))
            {
                isBackground[x, y] = true;
                queue.Enqueue((x, y));
            }
        }

        // Initialize queue with all 4 outer edges
        for (int x = 0; x < width; x++)
        {
            TryEnqueue(x, 0);
            TryEnqueue(x, height - 1);
        }
        for (int y = 0; y < height; y++)
        {
            TryEnqueue(0, y);
            TryEnqueue(width - 1, y);
        }

        while (queue.Count > 0)
        {
            var (cx, cy) = queue.Dequeue();
            TryEnqueue(cx + 1, cy);
            TryEnqueue(cx - 1, cy);
            TryEnqueue(cx, cy + 1);
            TryEnqueue(cx, cy - 1);
        }

        // Now compute smooth alpha and de-matte for each pixel
        int minX = width, maxX = 0, minY = height, maxY = 0;

        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                var px = original.GetPixel(x, y);
                float dr = px.Red - bgR;
                float dg = px.Green - bgG;
                float db = px.Blue - bgB;
                float dist = MathF.Sqrt(dr * dr + dg * dg + db * db);
                float brightness = (px.Red + px.Green + px.Blue) / 3f;

                byte alpha;
                if (isBackground[x, y])
                {
                    alpha = 0;
                }
                else
                {
                    // Check near edges of background for feathering
                    if (brightness > 248 && dist < 20f)
                    {
                        alpha = 0;
                    }
                    else if (dist < 35f && brightness > 235f)
                    {
                        float t = (dist - 15f) / 20f;
                        t = Math.Clamp(t, 0f, 1f);
                        alpha = (byte)(t * 255);
                    }
                    else
                    {
                        alpha = 255;
                    }
                }

                if (alpha > 15)
                {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }

                // De-matte color if semi-transparent
                if (alpha == 0)
                {
                    resultBitmap.SetPixel(x, y, new SKColor(0, 0, 0, 0));
                }
                else if (alpha == 255)
                {
                    resultBitmap.SetPixel(x, y, new SKColor(px.Red, px.Green, px.Blue, 255));
                }
                else
                {
                    float a = alpha / 255f;
                    byte r = (byte)Math.Clamp((px.Red - (1f - a) * bgR) / a, 0, 255);
                    byte g = (byte)Math.Clamp((px.Green - (1f - a) * bgG) / a, 0, 255);
                    byte b = (byte)Math.Clamp((px.Blue - (1f - a) * bgB) / a, 0, 255);
                    resultBitmap.SetPixel(x, y, new SKColor(r, g, b, alpha));
                }
            }
        }

        // Add small padding to bounding box
        int pad = 8;
        minX = Math.Max(0, minX - pad);
        minY = Math.Max(0, minY - pad);
        maxX = Math.Min(width - 1, maxX + pad);
        maxY = Math.Min(height - 1, maxY + pad);

        int cropW = Math.Max(1, maxX - minX + 1);
        int cropH = Math.Max(1, maxY - minY + 1);

        // Make it a clean square bounding box if desired or cropped
        using var cropped = new SKBitmap(cropW, cropH, SKColorType.Rgba8888, SKAlphaType.Premul);
        using (var canvas = new SKCanvas(cropped))
        {
            canvas.Clear(SKColors.Transparent);
            canvas.DrawBitmap(resultBitmap, new SKRect(minX, minY, maxX, maxY), new SKRect(0, 0, cropW, cropH));
        }

        using var image = SKImage.FromBitmap(cropped);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);

        foreach (var outPath in outputPaths)
        {
            var dir = Path.GetDirectoryName(outPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            using var outStream = File.Open(outPath, FileMode.Create, FileAccess.Write);
            data.SaveTo(outStream);
            Console.WriteLine($"[LogoProcessor] Successfully saved transparent logo to: {outPath}");
        }
    }
}
