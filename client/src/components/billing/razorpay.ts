/**
 * Razorpay Checkout script loader and minimal typings.
 *
 * The script is loaded lazily on first use (not bundled, not included on every
 * page). Razorpay Checkout is opened with a server-created `order_id`; the
 * amount lives on that order and is never sent from the client (CLAUDE.md §5.1
 * and C5 brief §2).
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
}

export interface RazorpayOptions {
  key: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (response: RazorpayFailureResponse) => void) => void;
  close: () => void;
}

type RazorpayCtor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loaderPromise: Promise<RazorpayCtor> | null = null;

/** Load `checkout.js` on demand and resolve with the `Razorpay` constructor. */
export function loadRazorpay(): Promise<RazorpayCtor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay can only load in the browser"));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<RazorpayCtor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay loaded but window.Razorpay is missing"));
    });
    script.addEventListener("error", () => {
      loaderPromise = null;
      reject(new Error("Failed to load Razorpay checkout script"));
    });
  });

  return loaderPromise;
}
