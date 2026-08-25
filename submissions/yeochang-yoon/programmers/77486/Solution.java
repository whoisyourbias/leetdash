import java.util.*;

class Solution {
    public int[] solution(String[] enroll, String[] referral, String[] seller, int[] amount) {
        
        Map<String, Integer> map = new HashMap<>();
        
        for(int i = 0; i < enroll.length; i++){
            map.put(enroll[i], i);
        }
        
        int[] total_profit = new int[enroll.length];
        
        for(int i = 0; i < seller.length; i++){
            int money = amount[i] * 100;
            
            if(money / 10 < 1){
                total_profit[map.get(seller[i])] += money;
                continue;
            }
            
            total_profit[map.get(seller[i])] += (money - money/10);
            money /= 10;
                
            Queue<String> queue = new ArrayDeque<>();
            queue.offer(seller[i]);
                
            while(!queue.isEmpty()){
                String name = queue.poll();
                
                String referral_name = referral[map.get(name)];
                if(referral_name.equals("-")){
                    continue;
                }
                
                if(money < 1){
                    continue;
                }
                
                total_profit[map.get(referral_name)] += (money - money / 10);
                money /= 10;
                queue.offer(referral_name);
            }
        }
        
        int[] answer = total_profit;
        return answer;
    }
}