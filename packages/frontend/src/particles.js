// Particle network effect (adapted from CodePen snippet)
// Keeps existing dark gradient visible by clearing the built-in background layer.

(function (factory) {
  const root =
    (typeof self === "object" && self.self === self && self) ||
    (typeof global === "object" && global.global === global && global);
  if (typeof define === "function" && define.amd) {
    define(["exports"], function (exports) {
      root.ParticleNetwork = factory(root, exports);
    });
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(root, {});
  } else {
    root.ParticleNetwork = factory(root, {});
  }
})(function (root, exports) {
  const Particle = function (instance) {
    this.canvas = instance.canvas;
    this.g = instance.g;
    this.particleColor = instance.options.particleColor;
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.velocity = {
      x: (Math.random() - 0.5) * instance.options.velocity,
      y: (Math.random() - 0.5) * instance.options.velocity,
    };
  };

  Particle.prototype.update = function () {
    if (this.x > this.canvas.width + 20 || this.x < -20) this.velocity.x = -this.velocity.x;
    if (this.y > this.canvas.height + 20 || this.y < -20) this.velocity.y = -this.velocity.y;
    this.x += this.velocity.x;
    this.y += this.velocity.y;
  };

  Particle.prototype.draw = function () {
    this.g.beginPath();
    this.g.fillStyle = this.particleColor;
    this.g.globalAlpha = 0.7;
    this.g.arc(this.x, this.y, 1.5, 0, 2 * Math.PI);
    this.g.fill();
  };

  const ParticleNetwork = function (element, options) {
    this.i = element;
    this.i.size = { width: this.i.offsetWidth, height: this.i.offsetHeight };
    options = options !== void 0 ? options : {};
    this.options = {
      particleColor: options.particleColor !== void 0 ? options.particleColor : "#fff",
      background: options.background !== void 0 ? options.background : "#1a252f",
      interactive: options.interactive !== void 0 ? options.interactive : true,
      velocity: this.setVelocity(options.speed),
      density: this.setDensity(options.density),
    };
    this.init();
  };

  ParticleNetwork.prototype.init = function () {
    this.k = document.createElement("div");
    this.i.appendChild(this.k);
    this.setStyle(this.k, {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      "z-index": 1,
    });

    const bgIsHex = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(this.options.background);
    const bgIsImage = /\.(gif|jpg|jpeg|tiff|png)$/i.test(this.options.background);

    if (bgIsHex) {
      this.setStyle(this.k, { background: this.options.background });
    } else if (bgIsImage) {
      this.setStyle(this.k, {
        background: 'url("' + this.options.background + '") no-repeat center',
        "background-size": "cover",
      });
    } else {
      console.error("Please specify a valid background image or hexadecimal color");
      return false;
    }

    if (!/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(this.options.particleColor)) {
      console.error("Please specify a valid particleColor hexadecimal color");
      return false;
    }

    this.canvas = document.createElement("canvas");
    this.i.appendChild(this.canvas);
    this.g = this.canvas.getContext("2d");
    this.canvas.width = this.i.size.width;
    this.canvas.height = this.i.size.height;
    this.setStyle(this.i, { position: "relative" });
    this.setStyle(this.canvas, { "z-index": "20", position: "relative" });

    window.addEventListener(
      "resize",
      function () {
        if (this.i.offsetWidth === this.i.size.width && this.i.offsetHeight === this.i.size.height) return false;
        this.canvas.width = this.i.size.width = this.i.offsetWidth;
        this.canvas.height = this.i.size.height = this.i.offsetHeight;
        clearTimeout(this.m);
        this.m = setTimeout(
          function () {
            this.particles = [];
            for (let n = 0; n < (this.canvas.width * this.canvas.height) / this.options.density; n++) {
              this.particles.push(new Particle(this));
            }
            if (this.options.interactive) this.particles.push(this.p);
            requestAnimationFrame(this.update.bind(this));
          }.bind(this),
          500,
        );
      }.bind(this),
    );

    this.particles = [];
    for (let n = 0; n < (this.canvas.width * this.canvas.height) / this.options.density; n++) {
      this.particles.push(new Particle(this));
    }

    if (this.options.interactive) {
      this.p = new Particle(this);
      this.p.velocity = { x: 0, y: 0 };
      this.particles.push(this.p);
      this.canvas.addEventListener(
        "mousemove",
        function (e) {
          this.p.x = e.clientX - this.canvas.offsetLeft;
          this.p.y = e.clientY - this.canvas.offsetTop;
        }.bind(this),
      );
      this.canvas.addEventListener(
        "mouseup",
        function () {
          this.p.velocity = {
            x: (Math.random() - 0.5) * this.options.velocity,
            y: (Math.random() - 0.5) * this.options.velocity,
          };
          this.p = new Particle(this);
          this.p.velocity = { x: 0, y: 0 };
          this.particles.push(this.p);
        }.bind(this),
      );
    }

    requestAnimationFrame(this.update.bind(this));
  };

  ParticleNetwork.prototype.update = function () {
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.g.globalAlpha = 1;
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].update();
      this.particles[i].draw();
      for (let j = this.particles.length - 1; j > i; j--) {
        const distance = Math.sqrt(
          Math.pow(this.particles[i].x - this.particles[j].x, 2) +
            Math.pow(this.particles[i].y - this.particles[j].y, 2),
        );
        if (distance > 120) continue;
        this.g.beginPath();
        this.g.strokeStyle = this.options.particleColor;
        this.g.globalAlpha = (120 - distance) / 120;
        this.g.lineWidth = 0.7;
        this.g.moveTo(this.particles[i].x, this.particles[i].y);
        this.g.lineTo(this.particles[j].x, this.particles[j].y);
        this.g.stroke();
      }
    }
    if (this.options.velocity !== 0) requestAnimationFrame(this.update.bind(this));
  };

  ParticleNetwork.prototype.setVelocity = function (speed) {
    if (speed === "fast") return 1;
    if (speed === "slow") return 0.33;
    if (speed === "none") return 0;
    return 0.66;
  };

  ParticleNetwork.prototype.setDensity = function (density) {
    if (density === "high") return 5000;
    if (density === "low") return 20000;
    const parsed = parseInt(density, 10);
    if (isNaN(parsed)) return 10000;
    return parsed;
  };

  ParticleNetwork.prototype.setStyle = function (element, styleObject) {
    for (const key in styleObject) {
      element.style[key] = styleObject[key];
    }
  };

  return ParticleNetwork;
});

// Initialize with SAFU palette; clear the library's background layer so our gradient stays visible.
const canvasDiv = document.getElementById("particle-canvas");
if (canvasDiv) {
  const accent =
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6bf1e3";

  const options = {
    particleColor: accent,
    background: "#03040a",
    interactive: true,
    speed: "medium",
    density: "high",
  };

  const particleCanvas = new ParticleNetwork(canvasDiv, options);
  if (particleCanvas && particleCanvas.k) {
    particleCanvas.k.style.background = "transparent";
  }
}
