"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Fragment = { id: string; text: string; weight?: number };
type MemoryRainResponse = { seed?: number; fragments?: Fragment[] };

const fallbackFragments: Fragment[] = [
  { id: "seed-1", text: "\u628a\u77ed\u6682\u7684\u5ff5\u5934\uff0c\u4ea4\u7ed9\u957f\u4e45\u7684\u56de\u58f0\u3002" },
  { id: "seed-2", text: "\u672a\u6765\u4f1a\u611f\u8c22\u4eca\u5929\u6ca1\u6709\u9057\u5931\u7684\u8fd9\u4e00\u53e5\u3002" },
  { id: "seed-3", text: "\u8bb0\u5f55\u4e0d\u662f\u6574\u7406\uff0c\u662f\u7ed9\u7075\u611f\u7559\u95e8\u3002" },
];

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeTextTexture(text: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 720;
  canvas.height = 128;

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "500 34px serif";
    context.fillStyle = "rgba(248, 244, 234, 0.78)";
    context.shadowColor = "rgba(194, 138, 72, 0.38)";
    context.shadowBlur = 16;
    context.fillText(text.slice(0, 42), 20, 72);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function MemoryRain() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 1800);
    camera.position.z = 760;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    async function loadFragments() {
      const response = await fetch("/api/memory-rain").catch(() => null);
      if (!response?.ok) return { seed: 1, fragments: fallbackFragments };
      const body = (await response.json()) as MemoryRainResponse;
      return {
        seed: body.seed ?? 1,
        fragments: body.fragments?.length ? body.fragments : fallbackFragments,
      };
    }

    loadFragments().then(({ seed, fragments }) => {
      if (disposed) return;
      const rng = createRng(seed);
      const amount = Math.min(Math.max(fragments.length, 12), 48);
      for (let index = 0; index < amount; index += 1) {
        const fragment = fragments[index % fragments.length];
        const material = new THREE.SpriteMaterial({
          map: makeTextTexture(fragment.text),
          transparent: true,
          opacity: 0.2 + rng() * 0.34,
          depthTest: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(rng() * 1400 - 700, rng() * 900 - 450, rng() * 800 - 600);
        sprite.scale.set(260 + rng() * 220, 48 + rng() * 32, 1);
        sprite.userData.speed = 0.18 + rng() * 0.42;
        sprite.userData.phase = rng() * Math.PI * 2;
        group.add(sprite);
      }
    });

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
      if (disposed) return;
      group.children.forEach((child, index) => {
        child.position.y -= child.userData.speed;
        child.position.x += Math.sin(Date.now() * 0.00025 + child.userData.phase + index) * 0.08;
        if (child.position.y < -520) {
          child.position.y = 520;
        }
      });
      group.rotation.y = Math.sin(Date.now() * 0.00008) * 0.08;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.addEventListener("resize", onResize);
    animate();

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      group.children.forEach((child) => {
        const sprite = child as THREE.Sprite;
        const material = sprite.material as THREE.SpriteMaterial;
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-80 max-sm:opacity-35" />;
}