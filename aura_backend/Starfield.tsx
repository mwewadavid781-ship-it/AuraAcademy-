import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function Starfield() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile device
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);

    if (!mountRef.current) return;

    // ===== THREE.JS SETUP =====
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Renderer (optimized for performance)
    const renderer = new THREE.WebGLRenderer({
      antialias: !mobile, // Disable AA on mobile
      alpha: true,
      powerPreference: "low-power", // Mobile optimization
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(mobile ? 1 : window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    renderer.shadowMap.enabled = false; // Disable shadows for performance
    mountRef.current.appendChild(renderer.domElement);

    // ===== CREATE STARS =====
    // Reduce star count on mobile for performance
    const starCount = mobile ? 1500 : 3000;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    // Color palette (indigo/purple/mint theme)
    const colorA = new THREE.Color(0x818cf8); // Indigo
    const colorB = new THREE.Color(0xa78bfa); // Purple
    const colorC = new THREE.Color(0x7dd3fc); // Cyan

    for (let i = 0; i < starCount; i++) {
      // Position (spread across larger area on mobile for parallax effect)
      positions[i * 3] = (Math.random() - 0.5) * (mobile ? 20 : 30);
      positions[i * 3 + 1] = (Math.random() - 0.5) * (mobile ? 15 : 25);
      positions[i * 3 + 2] = (Math.random() - 0.5) * (mobile ? 25 : 40);

      // Color (random from palette)
      const color = [colorA, colorB, colorC][
        Math.floor(Math.random() * 3)
      ];
      const brightness = 0.6 + Math.random() * 0.5; // 0.6 - 1.0
      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;

      // Size (smaller on mobile)
      sizes[i] = mobile ? 0.08 : 0.12;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // Material
    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      sizeAttenuation: true,
      fog: false,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
    starsRef.current = stars;

    // ===== ANIMATION LOOP =====
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Slow rotation
      if (stars) {
        stars.rotation.z += 0.00005;
        stars.rotation.x += 0.000025;
      }

      // Mouse parallax (reduced on mobile)
      const parallaxStrength = mobile ? 0.3 : 0.5;
      camera.position.x =
        mouseRef.current.x * parallaxStrength;
      camera.position.y =
        mouseRef.current.y * parallaxStrength;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // ===== MOUSE TRACKING =====
    const onMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    // Touch tracking (for mobile)
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      mouseRef.current.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, false);

    // ===== HANDLE WINDOW RESIZE =====
    const onWindowResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", onWindowResize);

    // ===== CLEANUP =====
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onWindowResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    />
  );
}
