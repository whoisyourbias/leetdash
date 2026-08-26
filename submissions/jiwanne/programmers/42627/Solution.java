import java.util.PriorityQueue;
import java.util.Arrays;

class Solution {
    public int solution(int[][] jobs) {
        int answer = 0;
        Arrays.sort(jobs, (a, b) -> a[0] - b[0]);
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[1] - b[1]);

        int time = 0;
        int index = 0;
        int count = 0;
         
        while (count < jobs.length) {
            while (index < jobs.length && jobs[index][0] <= time) {
                pq.offer(jobs[index++]);
            }

            if (!pq.isEmpty()) {

                int[] job = pq.poll();
                
                time += job[1];
                answer += time - job[0];
                count++;
            } else {
                time = jobs[index][0];
            }
        }
        
        answer /= jobs.length;

        
        return answer;
    }
}