import java.util.*;

class Solution {
    public int[] solution(int[] prices) {
        
        int p = prices.length;
        int[] answer = new int [p];
        
        Stack<Integer> stack = new Stack<Integer>();
        
        for(int i = 0; i < p; i++) {
            while(!stack.isEmpty() && prices[stack.peek()] > prices[i]) {
                int idx = stack.pop();
                answer[idx] = i - idx;
                
            }
            stack.push(i);
        }
        
        while(!stack.isEmpty()) {
            int idx = stack.pop();
            answer[idx] = p - 1 - idx;
        }
        
        
        return answer;
    }
}