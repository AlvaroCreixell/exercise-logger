import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement the Pointer Events API's capture methods. Some
// libraries (sonner, Base UI primitives) call setPointerCapture/etc during
// click handling and throw if the methods are missing. Provide no-op
// implementations so tests that render those components don't leak unhandled
// errors.
if (typeof Element !== "undefined") {
  Element.prototype.setPointerCapture ??= function () {};
  Element.prototype.releasePointerCapture ??= function () {};
  Element.prototype.hasPointerCapture ??= function () {
    return false;
  };
}
