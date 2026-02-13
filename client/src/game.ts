import { Application, Graphics } from 'pixi.js';

export async function initGame() {
  const canvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }

  const app = new Application();
  // Initialize the application
  await app.init({
    canvas: canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x2c3e50, // Dark blue background
    resizeTo: window
  });

  // Create a simple graphic to prove it's working
  const graphics = new Graphics();

  // Draw a red rectangle
  graphics.rect(0, 0, 100, 100);
  graphics.fill(0xe74c3c);

  // Center the rectangle
  graphics.x = app.screen.width / 2 - 50;
  graphics.y = app.screen.height / 2 - 50;

  app.stage.addChild(graphics);

  console.log("Game initialized with PixiJS!");
}
