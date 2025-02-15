module.exports = class Spell {
  constructor(data) {
    this.trigger = new RegExp(data.trigger, "i");
    this.responses = data.responses.map(x =>
      typeof x == "object" ? x :
        /^\d+(.\d+)?\$/.test(x) ? {
          text: x.split("$").slice(1).join("$"),
          weight: parseFloat(x.split("$")[0])
        } : { text: x }
    );
  }

  match(msg) {
    return this.trigger.test(msg.replace(/\n+/g, " ").replace(/[^a-z0-9- ]/ig, ""));
  }

  chooseResponse(guarantee) {
    if (this.responses.length == 1) return this.responses[0].text;
    if (guarantee > -1 && guarantee < this.responses.length) return this.responses[guarantee].text;

    let weights = [this.responses[0].weight || 1];
    for (let i = 1; i < this.responses.length; i++)
      weights[i] = (this.responses[i].weight || 1) + weights[i - 1];

    let random = Math.random() * weights[weights.length - 1];
    let i;
    for (i = 0; i < weights.length; i++)
      if (weights[i] > random)
        break;

    return this.responses[i].text;
  }

  toJSON() {
    return {
      trigger: this.trigger.source,
      responses: this.responses.map(x => `${x.weight ? x.weight + "$" : ""}${x.text}`)
    }
  }
}