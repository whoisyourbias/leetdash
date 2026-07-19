import java.util.*;

class Solution {
    public int maxProfit(int[] prices) {
        LinkedList<Integer> s = new LinkedList<>();
        
        int answer = 0;
        for (int i =0;i<prices.length;i++) {
            if (s.size() == 0) {
                s.push(prices[i]);
                continue;
            }
            
            if (s.size() != 0 && prices[i] <= s.peek()) {
                int top = s.pop();
                int min = Integer.MAX_VALUE;
                while (s.size() != 0 && s.peek() < top) {
                    if (s.peek() < min) {
                        min = s.peek();
                    }
                    s.pop();
                }
                s.clear();
                if (min != Integer.MAX_VALUE) {
                    answer += top - min;   
                }
            }
            s.push(prices[i]);
        }
        int min = Integer.MAX_VALUE;
        int max = 0;
        for (int i = 0 ; i < s.size(); i++){
            System.out.println(s.get(i));
            if (s.get(i) < min) {
                min=s.get(i);
            }
            if (s.get(i) > max) {
                max=s.get(i);
            }
        }
        
        answer += max - min;
        
        return answer;
    }
}
