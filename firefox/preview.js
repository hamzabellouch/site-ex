// Runs inside a sandboxed extension page: no extension APIs, scripts are allowed.
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'render') return;
  document.open();
  document.write(d.doc);
  document.close();
});
