// Runs before any page script: raises the resource-timing buffer so no files are missed
try { performance.setResourceTimingBufferSize(10000); } catch (e) {}
