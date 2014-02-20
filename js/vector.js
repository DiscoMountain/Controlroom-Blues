function Vector(x, y) {
  this.x = x;
  this.y = y;

  this.init = function (x, y) {
    this.x = x;
    this.y = y;
  }

  this.set = function (v) {
    this.x = v.x;
    this.y = v.y;
  }
  
  this.increase = function (v) {
    this.x += v.x;
    this.y += v.y;
  }

  this.decrease = function (v) {
    this.x -= v.x;
    this.y -= v.y;
  }

}

Vector.prototype.copy = function () {
  return new Vector(this.x, this.y);
};

Vector.prototype.add = function (v) {
  return new Vector(this.x + v.x, this.y + v.y);
};

Vector.prototype.subtract = function (v) {
  return new Vector(this.x - v.x, this.y - v.y);
};

Vector.prototype.multiply = function (a) {
  return new Vector(this.x * a, this.y * a);
};

Vector.prototype.length = function () {
  return Math.sqrt(x*x + y*y);
};

Vector.prototype.dot = function (v) {
  return this.x * v.x + this.y * v.y;
};

