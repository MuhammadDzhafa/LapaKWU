"""Run PaddleOCR 3 on a local receipt and emit the recognized lines as JSON."""
import contextlib
import json
import os
import sys
from pathlib import Path

from PIL import Image


def buat_ocr():
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(Path.cwd() / "data" / "paddlex"))
    with contextlib.redirect_stdout(sys.stderr):
        from paddleocr import PaddleOCR

        return PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
            text_rec_score_thresh=0.70,
            device="cpu",
            cpu_threads=2,
            enable_mkldnn=False,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )


def baca(ocr, path):
    with Image.open(path) as image:
        if image.width * image.height > 12_000_000:
            raise ValueError("Receipt dimensions exceed the OCR limit")
        image.verify()

    with contextlib.redirect_stdout(sys.stderr):
        return [text for result in ocr.predict(path) for text in result["rec_texts"]]


def main():
    ocr = buat_ocr()
    if sys.argv[1] != "--worker":
        print(json.dumps(baca(ocr, sys.argv[1]), ensure_ascii=True))
        return
    for baris in sys.stdin:
        try:
            hasil = baca(ocr, json.loads(baris))
        except Exception as error:
            print(type(error).__name__, file=sys.stderr, flush=True)
            hasil = None
        print("LAPAKWU_OCR " + json.dumps(hasil, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    main()
