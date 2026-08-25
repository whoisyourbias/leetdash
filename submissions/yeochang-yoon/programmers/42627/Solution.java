import java.util.*;

class Solution {
    
    public int solution(int[][] jobs) {
        
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> {
            if(a[1] == b[1]){
                return a[0] - b[0];
            }
            
            return a[1] - b[1];
        });
        
        Queue<int[]> queue = new ArrayDeque<>();
        
        Arrays.sort(jobs, (a, b) -> Integer.compare(a[0], b[0]));
        
        for(int i = 0; i < jobs.length; i++){
            queue.offer(new int[] {jobs[i][0], jobs[i][1]});
        }
        
        int time = 0;
        int sum = 0;
        
        while(!queue.isEmpty()){
            time = Math.max(time, queue.peek()[0]);
            pq.offer(queue.poll());
            
            while(!pq.isEmpty()){
                while(!queue.isEmpty() && queue.peek()[0] <= time){
                    pq.offer(queue.poll());
                }
            
                int[] task = pq.poll();
            
                sum += time + task[1] - task[0];
                time += task[1];
            }
        }
        
        int answer = sum / jobs.length;
        return answer;
    }
}