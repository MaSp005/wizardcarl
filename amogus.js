const skia = require("skia-canvas");

skia.FontLibrary.use("Comic", ["./amogus/COMIC.TTF"]);
const amogusnum = require("fs").readdirSync("./amogus").filter(x => /\d+\.png/.test(x)).length;

const amogusunicode = new skia.Image(66, 67);
amogusunicode.src = "./amogus/amogusunicode.png";

exports.gen = () => {
  return new Promise((res, rej) => {
    try {
      const canvas = new skia.Canvas(800, 1000);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, 800, 1000);
      ctx.fillStyle = "white";
      ctx.fillRect(90, 90, 620, 620);
      ctx.textAlign = "center";
      ctx.font = "80px Comic"
      let text = [
        () => ctx.fillText("amogus", 400, 900),
        () => ctx.drawImage(amogusunicode, 367, 837)
      ][Math.floor(Math.random() * 2)]();
      // ctx.fillText(text, 400, 900);

      let img = new skia.Image(600, 600);
      img.onload = () => {
        ctx.drawImage(img, 100, 100);

        const size = 40 + Math.random() * 100;
        img = new skia.Image();
        img.onload = () => {
          ctx.drawImage(img,
            100 + size + Math.random() * (600 - size * 3),
            100 + size + Math.random() * (600 - size * 3),
            size,
            size * (img.height / img.width)
          );

          const fn = "./amogus/gen/" + (Date.now() % 100) + ".png";
          canvas.saveAsSync(fn);
          res(fn);
        }
        img.src = "./amogus/" + Math.floor(Math.random() * amogusnum) + ".png";
      }
      img.src = "https://picsum.photos/600/600";
    } catch { rej() }
  })
}