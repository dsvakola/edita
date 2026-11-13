; 8085 program: add two 8-bit numbers and store the result
; Vidyasagar Robotics Academy - microprocessor lab

        ORG 2000H
START:  LDA 2050H       ; first number
        MOV B, A
        LDA 2051H       ; second number
        ADD B           ; A = A + B
        STA 2052H       ; store the sum
        JNC DONE        ; no carry? finish
        MVI A, 01H
        STA 2053H       ; store the carry
DONE:   HLT
