
extern scanf
extern printf
extern fopen
extern fprintf
extern fclose
extern exit

global main

segment data use32 class=data
    msgN        db "Introduceti N: ",0
    msgNumere   db "Introduceti numerele:",10,0
    fmt_int     db "%d",0
    fmt_write   db "Suma este: %d",0
    file_name   db "output.txt",0
    mode_write  db "w",0

    N       resd 1
    x       resd 1
    suma    resd 1
    fp      resd 1

segment code use32 class=data

main:

    ;Afisam "Introduceti N:"
    push msgN
    call [printf]
    add esp, 4

    ;scanf("%d", &N)
    push N
    push fmt_int
    call [scanf]
    add esp, 8

    ; suma = 0
    mov dword [suma], 0

    ;Afisam mesajul de introducere numere
    push msgNumere
    call [printf]
    add esp, 4

    ;citim N numere
    mov ecx, [N]        ; ECX = N

citire_loop:
    cmp ecx, 0
    jz dupa_citire

    ; scanf("%d", &x)
    push x
    push fmt_int
    call [scanf]
    add esp, 8

    ; suma += x
    mov eax, [suma]
    add eax, [x]
    mov [suma], eax

    dec ecx
    jmp citire_loop

dupa_citire:

    ;fopen("output.txt", "w")
    push mode_write
    push file_name
    call [fopen]
    add esp, 8

    test eax, eax
    jz eroare
    mov [fp], eax

    ; fprintf(fp, "Suma este: %d", suma)
    push dword [suma]
    push fmt_write
    push dword [fp]
    call [fprintf]
    add esp, 12

    ; fclose(fp)
    push dword [fp]
    call [fclose]
    add esp, 4

    ; exit(0)
    push 0
    call [exit]

eroare:
    push 1
    call [exit]



