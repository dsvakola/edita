// Obstacle-avoiding robot v2 - smoother turns
#include <Servo.h>

#define TRIG_PIN   9
#define ECHO_PIN   10
#define LEFT_MOTOR  5
#define RIGHT_MOTOR 6
#define BUZZER     8

Servo scanner;
const int SAFE_DISTANCE = 30;   // centimetres

long readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  return duration * 0.034 / 2;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LEFT_MOTOR, OUTPUT);
  pinMode(RIGHT_MOTOR, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  scanner.attach(3);
  Serial.println("Robot v2 ready!");
}

void loop() {
  long distance = readDistance();
  if (distance > SAFE_DISTANCE) {
    analogWrite(LEFT_MOTOR, 220);
    analogWrite(RIGHT_MOTOR, 220);
  } else {
    tone(BUZZER, 1000, 100);
    analogWrite(LEFT_MOTOR, 90);
    analogWrite(RIGHT_MOTOR, 220);  // gentle right turn
    delay(300);
  }
}
