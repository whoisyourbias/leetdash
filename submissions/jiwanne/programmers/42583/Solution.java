import java.util.LinkedList;
import java.util.Queue;

class Solution {
    public int solution(int bridge_length, int weight, int[] truck_weights) {
        int answer = 0;
        
        Queue<Integer> q = new LinkedList<>();
        Queue<Integer> wait = new LinkedList<>();

        for (int x : truck_weights) {
            q.offer(x);
        }
        
        for(int i = 0 ; i < bridge_length; i++) {
            wait.offer(0);
        }
        int bridgeWeight = 0;

        while(!q.isEmpty() || bridgeWeight > 0) {
            int out = wait.poll();
            bridgeWeight -= out;
            if(!q.isEmpty()) {
                int next = q.peek();
                if(next + bridgeWeight <= weight) {
                    q.poll();
                    wait.offer(next);
                    bridgeWeight += next;
                } else {
                    wait.offer(0);
                }
            }
            answer++;
        }
        return answer;
    }
}