#!/usr/bin/env python3
"""Bubu ile İngilizce — doğal ses kliplerini üretir.

Uygulamanın söylediği her İngilizce cümleyi Kokoro-82M (Apache-2.0) sinir ağı sesiyle seslendirir ve
audio/ klasörüne paketler. Üretim tamamen bu bilgisayarda yapılır; oyun oynanırken hiçbir yere metin gitmez.

Kullanım:
  pip install kokoro-onnx onnxruntime numpy            (ffmpeg kurulu olmalı)
  # https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX adresinden:
  #   onnx/model.onnx, voices/af_heart.bin, voices/bf_emma.bin  ->  <model-klasörü>/
  node tools/dump-lines.mjs > lines.json
  python3 tools/make-voice.py lines.json <model-klasörü> audio/

Çıktı (her aksan için): audio/us.json  = { packs: [...], clips: { "metin": [paketNo, başlangıç, uzunluk] } }
                        audio/us-<paket>.mp3 = art arda eklenmiş MP3 klipleri
"""
import json, os, subprocess, sys, time
import numpy as np
import onnxruntime as ort
from kokoro_onnx.tokenizer import Tokenizer

VOICES = {'us': ('af_heart', 'en-us'), 'uk': ('bf_emma', 'en-gb')}
SR = 24000
SPEED = 0.92          # çocuklar için biraz yavaş, ama doğal

def main(lines_path, model_dir, out_dir):
    lines = json.load(open(lines_path, encoding='utf-8'))
    os.makedirs(out_dir, exist_ok=True)
    so = ort.SessionOptions(); so.intra_op_num_threads = os.cpu_count() or 4
    sess = ort.InferenceSession(os.path.join(model_dir, 'onnx', 'model.onnx'), so)
    tok = Tokenizer()
    for acc, (voice, lang) in VOICES.items():
        if acc not in lines: continue
        styles = np.fromfile(os.path.join(model_dir, 'voices', voice + '.bin'), dtype=np.float32).reshape(-1, 1, 256)
        by_pack = {}
        for text, pack in lines[acc].items(): by_pack.setdefault(pack, []).append(text)
        packs = ['core'] + sorted(k for k in by_pack if k != 'core')
        clips, t0, n = {}, time.time(), 0
        for pi, pack in enumerate(packs):
            blob = bytearray()
            for text in sorted(by_pack.get(pack, [])):
                mp3 = encode(synth(sess, tok, styles, lang, text))
                clips[text] = [pi, len(blob), len(mp3)]
                blob += mp3; n += 1
                if n % 100 == 0: print(f'{acc}: {n}/{len(lines[acc])}  {time.time() - t0:.0f}s', flush=True)
            open(os.path.join(out_dir, f'{acc}-{pack}.mp3'), 'wb').write(blob)
        json.dump({'voice': voice, 'packs': packs, 'clips': clips}, open(os.path.join(out_dir, acc + '.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, separators=(',', ':'))
        print(f'{acc}: {n} klip, {sum(os.path.getsize(os.path.join(out_dir, f"{acc}-{p}.mp3")) for p in packs) / 1e6:.1f} MB', flush=True)

def synth(sess, tok, styles, lang, text):
    # Tek kelimeler düz bir cümle gibi okunsun diye nokta eklenir ("cat" -> "Cat.")
    spoken = text if text[-1] in '.!?' else text[0].upper() + text[1:] + '.'
    ids = tok.tokenize(tok.phonemize(spoken, lang))[:500]
    audio = sess.run(None, {'input_ids': np.array([[0, *ids, 0]], dtype=np.int64), 'style': styles[len(ids)],
                            'speed': np.array([SPEED], dtype=np.float32)})[0].reshape(-1)
    # baştaki/sondaki sessizliği kırp, kısa bir yumuşatma ekle
    idx = np.where(np.abs(audio) > 0.012)[0]
    if len(idx): audio = audio[max(0, idx[0] - 600): idx[-1] + 2400]
    f = min(480, len(audio) // 4)
    audio[:f] *= np.linspace(0, 1, f); audio[-f:] *= np.linspace(1, 0, f)
    peak = float(np.max(np.abs(audio))) or 1.0
    return (audio * min(1.0, 0.89 / peak) if peak > 0.89 else audio * min(1.6, 0.8 / peak)).astype(np.float32)

def encode(audio):
    p = subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
                        '-codec:a', 'libmp3lame', '-b:a', '40k', '-f', 'mp3', 'pipe:1'], input=audio.tobytes(), capture_output=True, check=True)
    return p.stdout

if __name__ == '__main__':
    if len(sys.argv) != 4: sys.exit(__doc__)
    main(*sys.argv[1:])
