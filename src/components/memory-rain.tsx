"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Fragment = { id: string; text: string; weight?: number };

const fallbackFragments: Fragment[] = [
  { id: "seed-1", text: "把短暂的念头，交给长久的回声。" },
  { id: "seed-2", text: "未来会感谢今天没有遗失的这一句。" },
  { id: "seed-3", text: "记录不是整理，是给灵感留门。" },
];

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
      if (!response?.ok) return fallbackFragments;
      const body = (await response.json()) as { fragments?: Fragment[] };
      return body.fragments?.length ? body.fragments : fallbackFragments;
    }

    loadFragments().then((fragments) => {
      if (disposed) return;
      const amount = Math.min(Math.max(fragments.length, 12), 48);
      for (let index = 0; index < amount; index += 1) {
        const fragment = fragments[index % fragments.length];
        const material = new THREE.SpriteMaterial({
          map: makeTextTexture(fragment.text),
          transparent: true,
          opacity: 0.2 + Math.random() * 0.34,
          depthTest: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(Math.random() * 1400 - 700, Math.random() * 900 - 450, Math.random() * 800 - 600);
        sprite.scale.set(260 + Math.random() * 220, 48 + Math.random() * 32, 1);
        sprite.userData.speed = 0.18 + Math.random() * 0.42;
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
        child.position.x += Math.sin(Date.now() * 0.00025 + index) * 0.08;
        if (child.position.y < -520) {
          child.position.y = 520;
          child.position.x = Math.random() * 1400 - 700;
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
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-80 max-sm:opacity-35" />;
}
