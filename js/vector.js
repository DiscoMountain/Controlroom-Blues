function Vector(x, y) {
    this.x = x;
    this.y = y;
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
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
};

Vector.prototype.dot = function (v) {
    return this.x * v.x + this.y * v.y;
};
