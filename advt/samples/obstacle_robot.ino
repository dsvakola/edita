// Obstacle-avoiding robot - Vidyasagar Academy
#include <Servo.h>

#define TRIG_PIN   9
#define ECHO_PIN   10
#define LEFT_MOTOR  5
#define RIGHT_MOTOR 6

Servo scanner;
const int SAFE_DISTANCE = 25;   // centimetres

long readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  return duration * 0.034 / 2;
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LEFT_MOTOR, OUTPUT);
  pinMode(RIGHT_MOTOR, OUTPUT);
  scanner.attach(3);
  Serial.println("Robot ready!");
}

void loop() {
  long distance = readDistance();
  Serial.print("Distance: ");
  Serial.println(distance);

  if (distance > SAFE_DISTANCE) {
    analogWrite(LEFT_MOTOR, 200);
    analogWrite(RIGHT_MOTOR, 200);
  } else {
    analogWrite(LEFT_MOTOR, 0);
    analogWrite(RIGHT_MOTOR, 180);   // turn right
    delay(400);
  }
}
