// HostFix app notifications (DECISIONS.md, 2026-11-20, third entry).
// Shows a notification sent by the server and opens its page when tapped.
// The words never include an address or a door code: those are only on the page.
self.addEventListener("push", (event) => {
  let data = { title: "HostFix", body: "You have an update.", url: "/start" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Not JSON: keep the default words.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/start", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
