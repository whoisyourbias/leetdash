import java.util.*;

class Solution {
    public String solution(String number, int k) {
        StringBuilder stack = new StringBuilder();
        
        for (int i = 0; i < number.length() ; i++) {
            if (stack.isEmpty()) {
                stack.append(number.charAt(i));
                continue;
            }
            
            while (
                k > 0 &&
                stack.length() > 0 &&
                stack.charAt(stack.length() -1) < number.charAt(i)
            ) {
                stack.deleteCharAt(stack.length() - 1);
                k--;
            }
            
            stack.append(number.charAt(i));
        }
        
        while (k > 0) {
            stack.deleteCharAt(stack.length() - 1);
            k--;
        }
        
        return stack.toString();
    }
}