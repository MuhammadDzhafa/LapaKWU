"""Run PaddleOCR 3 on a local receipt and emit the recognized lines as JSON."""
import contextlib
import json
import os
import sys

from PIL import Image


def main():
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    path = sys.argv[1]
    with Image.open(path) as image:
        if image.width * image.height > 12_000_000:
            raise ValueError("Receipt dimensions exceed the OCR limit")
        image.verify()

    with contextlib.redirect_stdout(sys.stderr):
        from paddleocr import PaddleOCR

        ocr = PaddleOCR(
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
        lines = [text for result in ocr.predict(path) for text in result["rec_texts"]]
    print(json.dumps(lines, ensure_ascii=True))


if __name__ == "__main__":
    main()
