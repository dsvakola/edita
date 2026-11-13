import java.util.Scanner;

public class Calculator {

    public static double calculate(double a, double b, char op) {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/':
                if (b == 0) throw new ArithmeticException("Division by zero");
                return a / b;
            default:
                throw new IllegalArgumentException("Unknown operator: " + op);
        }
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        System.out.print("Enter two numbers and an operator: ");
        double a = in.nextDouble();
        double b = in.nextDouble();
        char op = in.next().charAt(0);
        System.out.println("Result = " + calculate(a, b, op));
    }
}
