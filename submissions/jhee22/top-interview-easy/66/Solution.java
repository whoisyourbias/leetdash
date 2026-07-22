/*
    (1) 끝자리 숫자가 9가 아닌 경우 : 끝자리 숫자에 1을 더함 
    (2) 끝자리 숫자가 9인 경우:  배열 한칸 더 선언하고, 1,0 ... 넘겨주기 
 */
class Solution {
    public int[] plusOne(int[] digits) { 
            for(int i = digits.length-1; i >= 0; i--){
                if(digits[i] != 9){
                    digits[i] += 1;
                    return digits;
                     
                }
                digits[i] = 0;
            }
            int[] result = new int[digits.length + 1]; 
            result[0] = 1;
            return result; 
        }// main

    }
