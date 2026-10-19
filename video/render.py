"""Render the SociHR 24-second product film from documented product captures."""
from pathlib import Path
import json
import math
import subprocess
import wave

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
W, H, FPS, DURATION = 1920, 1080, 30, 24
OUT = ROOT / 'SociHR-motion-24s.mp4'
ACCENT = (153, 144, 255)
FONT = 'C:/Windows/Fonts/segoeui.ttf'
BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
SCENES = [
    ('dashboard', '01 / OVERVIEW', 'Semua engagement.\nSatu pandangan.', 'Dashboard untuk pasukan HR.', (230, 0, 1440, 760)),
    ('staff-engagement', '02 / STAFF TICKS', 'Kenal pasti siapa\nyang aktif.', 'Semak completed, missed dan kadar engagement.', (290, 35, 1385, 830)),
    ('monitoring', '03 / MONITORING', 'Setiap sesi.\nSetiap platform.', 'Facebook, Instagram dan TikTok dalam satu matriks.', (260, 85, 1410, 900)),
    ('reports', '04 / REPORTS', 'Dari pemantauan\nke laporan.', 'Pilih tempoh. Eksport PDF atau Excel.', (255, 120, 1185, 720)),
]


def ease(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def text_layer(lines, size, color, bold=False):
    im = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(im)
    d.multiline_text((0, 0), lines, font=ImageFont.truetype(BOLD if bold else FONT, size), fill=color, spacing=12)
    box = im.getbbox()
    return im.crop(box) if box else im


def put(frame, layer, x, y, alpha=1):
    if alpha <= 0:
        return
    layer = layer.copy()
    if alpha < 1:
        layer.putalpha(layer.getchannel('A').point(lambda a: int(a * alpha)))
    frame.paste(layer, (int(x), int(y)), layer)


def audio():
    sr = 48000
    rng = np.random.default_rng(74)
    mix = np.zeros((sr * DURATION, 2), np.float64)

    def add(at, samples, gain=1, pan=0):
        start = int(at * sr)
        n = min(len(samples), len(mix) - start)
        if n <= 0:
            return
        mix[start:start+n, 0] += samples[:n] * gain * math.sqrt((1-pan)/2)
        mix[start:start+n, 1] += samples[:n] * gain * math.sqrt((1+pan)/2)

    # Original soft electronic score, 100 BPM. No downloaded music or samples.
    for beat in np.arange(0, 23.4, .6):
        t = np.arange(int(sr*.22))/sr
        kick = np.sin(2*np.pi*(48*t+6*(1-np.exp(-t*25)))) * np.exp(-t*24)
        add(beat, kick, .19)
        t = np.arange(int(sr*.055))/sr
        noise = rng.normal(0, 1, len(t))
        hat = np.diff(noise, prepend=0) * np.exp(-t*100)
        add(beat+.3, hat, .021, .25)
    for i, at in enumerate(np.arange(.0, 22.8, .3)):
        note = [220, 329.63, 440, 554.37, 440, 329.63, 277.18, 329.63][i % 8]
        t = np.arange(int(sr*.55))/sr
        pluck = (np.sin(2*np.pi*note*t)+.18*np.sin(2*np.pi*note*2*t))*np.exp(-t*8)*(1-np.exp(-t*90))
        add(at, pluck, .055, math.sin(i)*.4)
    for at in [0, 4.8, 9.6, 14.4, 19.2]:
        t = np.arange(int(sr*3.6))/sr
        pad = sum(np.sin(2*np.pi*f*t) for f in [110, 164.815, 220, 277.185])/4
        add(at, pad*np.minimum(t*2, 1)*np.exp(-t*.7), .1)
    # Short tactile clicks align with cursor pulses on each product shot.
    for at in [4.45, 8.85, 13.25, 17.65]:
        t = np.arange(int(sr*.09))/sr
        click = (.6*rng.normal(0, 1, len(t))+.4*np.sin(2*np.pi*1800*t))*np.exp(-t*95)
        add(at, click, .25)
    for at in [2.65, 7.05, 11.45, 15.85, 20.25]:
        t = np.arange(int(sr*.65))/sr
        noise = rng.normal(0, 1, len(t))
        filtered = np.convolve(noise, np.ones(16)/16, mode='same')
        add(at, filtered*np.sin(np.pi*t/.65)**2, .20, -.25)
    for f in [659.25, 830.61, 987.77]:
        t = np.arange(int(sr*1.5))/sr
        add(21, np.sin(2*np.pi*f*t)*np.exp(-t*3)*(1-np.exp(-t*60)), .08)
    timeline = np.arange(len(mix))/sr
    mix *= (np.clip(timeline/.35,0,1)*np.clip((24-timeline)/1.3,0,1))[:, None]
    mix *= .88 / max(.88, np.max(np.abs(mix)))
    with wave.open(str(ROOT/'soundtrack.wav'), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes((mix*32767).astype('<i2').tobytes())
    return float(np.max(np.abs(mix)))


def main():
    cv2.setNumThreads(4)
    yy, xx = np.mgrid[0:H, 0:W]
    light = np.exp(-((xx-1350)**2/(1050**2)+(yy-480)**2/(800**2)))
    bg = np.stack([12+light*12, 15+light*11, 26+light*24], axis=-1).astype(np.uint8)
    logo = Image.open(PROJECT/'socihr-frontend/public/logo.png').convert('RGBA')
    logo.thumbnail((94,94), Image.Resampling.LANCZOS)
    brand = text_layer('SociHR', 34, 'white', True)
    foot = text_layer('Social Media Engagement Monitor', 21, (160,168,191))
    source = text_layer('Paparan sistem daripada dokumentasi projek', 16, (130,140,165))
    intro = text_layer('Engagement staf,\nlebih jelas.', 110, 'white', True)
    intro_sub = text_layer('Pantau aktiviti sosial. Fahami prestasi pasukan.', 30, (177,184,205))
    outro = text_layer('SociHR', 144, 'white', True)
    outro_sub = text_layer('Pantau. Semak. Laporkan.', 43, (200,196,255))
    materials = []
    for name, label, title, subtitle, box in SCENES:
        shot = Image.open(PROJECT/f'docs/screenshots/{name}.png').convert('RGB').crop(box)
        shot = np.array(shot.resize((1160, 760), Image.Resampling.LANCZOS))
        materials.append((shot, text_layer(label,22,ACCENT,True), text_layer(title,61,'white',True), text_layer(subtitle,24,(177,184,205))))
    peak = audio()
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    args = [ffmpeg,'-y','-hide_banner','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(ROOT/'soundtrack.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',str(DURATION),str(OUT)]
    process = subprocess.Popen(args, stdin=subprocess.PIPE)
    previews = []
    for index in range(FPS*DURATION):
        t = index/FPS
        frame = Image.fromarray(bg.copy()).convert('RGBA')
        d = ImageDraw.Draw(frame)
        put(frame, logo.resize((48,48)), 74, 50)
        put(frame, brand, 138, 56)
        put(frame, foot, 74, 1000)
        if t < 3:
            a = ease(t/.8)
            put(frame, intro, 160, 328+40*(1-a), a)
            put(frame, intro_sub, 166, 626, ease((t-.5)/.8))
            # A single orbit uses the existing brand mark as the opening focus.
            size = int(260+25*ease(t/3))
            mark = logo.resize((size,size), Image.Resampling.LANCZOS)
            put(frame, mark, 1360-12*t, 410-9*t, a)
        elif t < 20.6:
            scene = min(3, int((t-3)/4.4))
            u = (t-3-scene*4.4)/4.4
            shot, label, title, subtitle = materials[scene]
            reveal = ease(u/.16)
            drift = ease(u)
            # Planar camera dolly: perspective settles, then pushes into the UI.
            left = 740-70*drift+150*(1-reveal)
            top = 210-25*drift
            width = 1110+100*drift
            height = 730+55*drift
            skew = (1-drift)*40 * (1 if scene%2 == 0 else -1)
            dst = np.float32([[left,top+skew],[left+width,top],[left+width,top+height],[left,top+height-skew]])
            src = np.float32([[0,0],[1160,0],[1160,760],[0,760]])
            matrix = cv2.getPerspectiveTransform(src,dst)
            warped = cv2.warpPerspective(shot,matrix,(W,H),flags=cv2.INTER_LINEAR)
            mask = cv2.warpPerspective(np.full((760,1160),255,np.uint8),matrix,(W,H))
            layer = Image.fromarray(warped).convert('RGBA')
            layer.putalpha(Image.fromarray((mask*reveal).astype(np.uint8)))
            frame.alpha_composite(layer)
            put(frame,label,76,306+25*(1-reveal),reveal)
            put(frame,title,72,365+35*(1-reveal),reveal)
            # Subtitle breaks are deliberate for the narrow editorial column.
            subs = ['Dashboard untuk\npasukan HR.', 'Semak completed, missed\ndan kadar engagement.', 'Facebook, Instagram dan TikTok\ndalam satu matriks.', 'Pilih tempoh.\nEksport PDF atau Excel.']
            put(frame,text_layer(subs[scene],26,(177,184,205)),76,565,reveal)
            put(frame,source,1200,1006)
            # Cursor and click ripple remain in the shot's camera coordinate space.
            local = t-(3+scene*4.4)
            target = [(650,180),(970,380),(620,590),(1035,475)][scene]
            p = ease((local-.5)/.95)
            sx,sy = 900+(target[0]-900)*p, 660+(target[1]-660)*p
            pt = cv2.perspectiveTransform(np.float32([[[sx,sy]]]),matrix)[0,0]
            cx,cy = float(pt[0]),float(pt[1])
            draw = ImageDraw.Draw(frame)
            if local > .45:
                draw.polygon([(cx,cy),(cx+5,cy+30),(cx+13,cy+21),(cx+25,cy+22)],fill=(23,25,40),outline='white',width=2)
            click_age = local-1.45
            if 0 <= click_age < .5:
                r = 12+click_age*75
                ring = Image.new('RGBA',(W,H))
                ImageDraw.Draw(ring).ellipse((cx-r,cy-r,cx+r,cy+r),outline=(*ACCENT,int(220*(1-click_age/.5))),width=3)
                frame.alpha_composite(ring)
            # Brief directional shutter bridges the shots instead of abrupt cuts.
            if u > .945:
                edge = int(W*ease((u-.945)/.055))
                ImageDraw.Draw(frame).rectangle((W-edge,0,W,H),fill=(12,15,26))
        else:
            a = ease((t-20.6)/.65)
            put(frame,logo.resize((124,124),Image.Resampling.LANCZOS),898,235,a)
            put(frame,outro,(W-outro.width)/2,407+25*(1-a),a)
            put(frame,outro_sub,(W-outro_sub.width)/2,619,ease((t-21)/.7))
            endline = text_layer('Social Media Engagement Monitor untuk HR',27,(177,184,205))
            put(frame,endline,(W-endline.width)/2,714,ease((t-21.3)/.7))
        draw = ImageDraw.Draw(frame)
        draw.rectangle((74,1055,W-74,1057),fill=(48,53,72))
        draw.rectangle((74,1055,74+(W-148)*t/24,1057),fill=ACCENT)
        if t > 23.5:
            black = Image.new('RGBA',(W,H),(12,15,26,int(255*ease((t-23.5)/.5))))
            frame.alpha_composite(black)
        frame = frame.convert('RGB')
        if index in [45,150,282,414,546,660]:
            preview = ROOT/f'frame-{index:04}.jpg'
            frame.save(preview,quality=92)
            previews.append(frame.resize((640,360)))
        process.stdin.write(frame.tobytes())
        if index % 120 == 0:
            print(f'Render {index}/{FPS*DURATION}',flush=True)
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError('FFmpeg failed')
    contact = Image.new('RGB',(1920,720))
    for i,im in enumerate(previews):
        contact.paste(im,((i%3)*640,(i//3)*360))
    contact.save(ROOT/'storyboard.jpg',quality=94)
    cap = cv2.VideoCapture(str(OUT))
    result = {'file':OUT.name,'frames':int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),'fps':cap.get(cv2.CAP_PROP_FPS),'width':int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),'height':int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),'audio_peak':peak,'source':'Existing docs/screenshots product captures; no live session recording','bytes':OUT.stat().st_size}
    cap.release()
    result['duration_seconds'] = result['frames']/result['fps']
    assert result['frames'] == 720 and result['duration_seconds'] == 24
    subprocess.run([ffmpeg,'-v','error','-i',str(OUT),'-f','null','-'],check=True)
    (ROOT/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    main()
