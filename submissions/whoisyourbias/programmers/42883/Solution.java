import java.util.*;

class Solution {
    public String solution(String number, int k) {
        String answer = "";
        boolean[] selected = new boolean[number.length()];
        Arrays.fill(selected, true);
        int i =0;
        while (i < number.length()) {
            int before = i;
            
            int max = -1;
            int max_i = -1;
            for (; (i < before + k + 1) && (i < number.length()); i++) {
                if (number.charAt(i) - '0' > max) {
                    max = number.charAt(i) - '0';
                    max_i = i;
                }
            }
            i = before;
            while (k > 0 && i < max_i) {
                selected[i] = false;
                k--;
                i++;
            }
            
            if (k == number.length() - i - 1) {
                i++;
                while (i < number.length()) {
                   selected[i++] = false;
                    k--;
                }
            }
            
            i++;
        }
        
        for (i = 0; i < number.length(); i++) {
            if (selected[i] == true)
                answer = answer.concat(String.valueOf(number.charAt(i)));
        }
        return answer;
    }
}