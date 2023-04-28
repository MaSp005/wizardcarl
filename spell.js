module.exports = class Spell {
  constructor(data) {
    this.trigger = new RegExp(data.trigger, "i");
    this.responses = data.responses.map(x =>
      typeof x == "object" ? x :
        x.includes("$") ? {
          text: x.split("$").slice(1).join("$"),
          weight: parseFloat(x.split("$")[0])
        } : { text: x }
    );
  }

  match(msg) {
    this.trigger.test(msg.replace(/[^a-z]/ig,""))
  }

  chooseResponse() {
    console.log(this);
    let weights = [this.responses[0].weight || 1];
    for (let i = 1; i < this.responses.length; i++)
      weights[i] = (this.responses[i].weight || 1) + weights[i - 1];
    console.log(weights);
    let random = Math.random() * weights[weights.length - 1];
    console.log(random);
    let i;
    for (i = 0; i < weights.length; i++)
      if (weights[i] > random)
        break;
    return this.responses[i].text;
  }
}