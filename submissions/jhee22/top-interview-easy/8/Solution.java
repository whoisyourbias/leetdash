class Solution {
    public int myAtoi(String s) {
        int idx = 0; 
        long result = 0; 
        int sign = 1;  

        // 공백 이동 
        while (idx < s.length() && s.charAt(idx) == ' '){
            idx++; 
        } 

        if (idx == s.length()){
            return 0;
        }

        // 부호 확인 
        if (idx < s.length()
        && (s.charAt(idx) == '-' || s.charAt(idx) == '+')) {

            if (s.charAt(idx) == '-') {
                sign = -1;
            }
            idx++;
        }

        // 숫자 읽기 
        while (idx < s.length() && Character.isDigit(s.charAt(idx))){
            int num = s.charAt(idx) - '0';
            result = result * 10 + num;
            
            // 양수 범위 초과
            if (sign == 1 && result > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }

            // 음수 범위 초과
            if (sign == -1 && result > 2147483648L) {
                return Integer.MIN_VALUE;
            }
            idx++; 
        }
    return (int) (result * sign); 
    } // main
}