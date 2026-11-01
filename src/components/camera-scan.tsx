import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

export function CameraScan({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let stream: MediaStream | undefined;

    const start = async () => {
      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
        }
      ).BarcodeDetector;
      if (!Detector) {
        toast.error(
          "Camera scanning isn't supported in this browser. Use a USB barcode scanner with the scan box instead.",
        );
        onClose();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        toast.error("Could not open the camera.");
        onClose();
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // autoplay restrictions; user gesture already happened
        }
      }
      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"],
      });
      const tick = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            onDetect(codes[0].rawValue);
            return; // parent closes the overlay; cleanup stops the camera
          }
        } catch {
          // frame not ready; keep polling
        }
        timer = window.setTimeout(tick, 350);
      };
      void tick();
    };

    void start();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetect, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-sm font-medium">Point the camera at a barcode</p>
          <button
            type="button"
            aria-label="Close camera"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <video
          ref={videoRef}
          className="aspect-video w-full bg-black object-cover"
          muted
          playsInline
          autoPlay
        />
      </div>
    </div>
  );
}
