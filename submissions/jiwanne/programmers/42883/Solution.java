import java.util.Stack;

class Solution {
    public String solution(String number, int k) {
        int l = number.length() - k;
        Stack<Character> stack = new Stack<>();
        
        for(int i = 0; i < number.length(); i++) {
            char c = number.charAt(i);
            
            while(!stack.isEmpty() && k > 0 && stack.peek() < c) {
                stack.pop();
                k--;
            }
            stack.push(c);
            
        }
        
        StringBuilder sb = new StringBuilder();
        
        for(int i = 0; i < l; i++) {
            sb.append(stack.get(i));
        }
        
         
        return sb.toString();
    }
}