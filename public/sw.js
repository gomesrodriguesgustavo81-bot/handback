// Service worker do Handback: só mostra as notificações e abre o aviso ao tocar.
self.addEventListener("push", (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch {
    d = { titulo: evento.data ? evento.data.text() : "Handback" };
  }
  const link = typeof d.link === "string" && d.link.startsWith("/") ? d.link : "/app";
  evento.waitUntil(
    self.registration.showNotification(d.titulo || "Handback", {
      body: d.texto || "",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { link },
      tag: link,
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const link = (evento.notification.data && evento.notification.data.link) || "/app";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (new URL(j.url).origin === self.location.origin && "focus" in j) {
          j.navigate(link);
          return j.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
