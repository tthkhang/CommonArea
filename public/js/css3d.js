// A tiny stand-in for three.js' CSS3DRenderer (kept local so the game needs no extra download):
// it places HTML elements (the cinema's YouTube player) in the 3D scene, on a layer BEHIND the WebGL canvas.
// The WebGL scene shows them through a "hole" (see rooms/cinema.js).
const eps = (v) => (Math.abs(v) < 1e-10 ? 0 : v);
function cameraMatrix(m) {
  const e = m.elements;
  return `matrix3d(${eps(e[0])},${eps(-e[1])},${eps(e[2])},${eps(e[3])},${eps(e[4])},${eps(-e[5])},${eps(e[6])},${eps(e[7])},${eps(e[8])},${eps(-e[9])},${eps(e[10])},${eps(e[11])},${eps(e[12])},${eps(-e[13])},${eps(e[14])},${eps(e[15])})`;
}
function objectMatrix(m) {
  const e = m.elements;
  return `translate(-50%,-50%)matrix3d(${eps(e[0])},${eps(e[1])},${eps(e[2])},${eps(e[3])},${eps(-e[4])},${eps(-e[5])},${eps(-e[6])},${eps(-e[7])},${eps(e[8])},${eps(e[9])},${eps(e[10])},${eps(e[11])},${eps(e[12])},${eps(e[13])},${eps(e[14])},${eps(e[15])})`;
}

export function createCss3dLayer(container) {
  const view = document.createElement('div');
  view.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;';
  const camEl = document.createElement('div');
  camEl.style.cssText = 'position:absolute;left:0;top:0;transform-style:preserve-3d;';
  view.append(camEl); container.append(view);
  const items = []; // { element, object }
  let w = 1, h = 1;
  return {
    /** element: HTML element; object: a THREE.Object3D whose world matrix places it (1 CSS pixel = 1 unit before the object's scale). */
    add(element, object) {
      element.style.position = 'absolute'; element.style.pointerEvents = 'auto';
      camEl.append(element); items.push({ element, object });
    },
    setSize(width, height) {
      w = width; h = height;
      for (const n of [view, camEl]) { n.style.width = width + 'px'; n.style.height = height + 'px'; }
    },
    render(camera) {
      if (!items.some((i) => i.object.visible)) { view.style.display = 'none'; return; }
      view.style.display = '';
      const fov = camera.projectionMatrix.elements[5] * (h / 2);
      view.style.perspective = fov + 'px';
      camEl.style.transform = `translateZ(${fov}px)${cameraMatrix(camera.matrixWorldInverse)}translate(${w / 2}px,${h / 2}px)`;
      for (const { element, object } of items) {
        element.style.display = object.visible ? '' : 'none';
        if (object.visible) { object.updateMatrixWorld(); element.style.transform = objectMatrix(object.matrixWorld); }
      }
    },
  };
}
