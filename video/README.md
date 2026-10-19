# SociHR motion showcase

**Video:** [SociHR-motion-24s.mp4](SociHR-motion-24s.mp4)

24 seconds, 1920 × 1080, 30 fps. H.264 video with stereo AAC audio.

## Sequence

| Time | Content |
| --- | --- |
| 0–3s | SociHR brand introduction |
| 3–7.4s | Dashboard overview |
| 7.4–11.8s | Staff Ticks |
| 11.8–16.2s | Monitoring sessions and platform matrix |
| 16.2–20.6s | PDF and Excel reports |
| 20.6–24s | Brand closing |

Product visuals come from the existing `docs/screenshots/` files, rather than a live recording. Figures shown belong to those captures and are not claims about current data. The pointer movements and click pulses are editorial motion, not recorded interactions. Feature selection was checked against CodeGraph and `PRODUCT.md`.

The film uses the existing SociHR logo and violet accent. The dark surrounding canvas separates the light product captures from the titles. Perspective dolly moves direct attention into each screen; brief directional wipes separate workflows. Malay captions describe the actual functions. The score, clicks, transition swishes and closing chime are synthesized by the render script, with no downloaded music.

## Re-render

From the project root on Windows, with Python 3.10 or later:

```powershell
python -m pip install pillow numpy opencv-python imageio-ffmpeg
python video/render.py
```

The script uses the Windows Segoe UI fonts, reads the project screenshots and logo, and writes the MP4, soundtrack, six preview frames, storyboard and verification JSON to this directory.

## Verification

- 720 decoded frames, 30 fps, exactly 24 seconds.
- Output dimensions verified as 1920 × 1080.
- Full FFmpeg decode check completed without errors.
- Six-frame storyboard visually checked for text layout and product visibility.
- Stereo soundtrack includes an original electronic bed, four synchronized click cues, five transition swishes and a closing chime.

See `verification.json` for machine-checked output metadata and `storyboard.jpg` for the sequence preview.
