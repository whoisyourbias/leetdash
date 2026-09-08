import java.util.*;
import java.io.*;

class Solution {
    public long solution(int n, int[] works) {
        long answer = 0;

        PriorityQueue<Integer> w = new PriorityQueue<Integer>(
        (a,b) -> b-a);
        for (int i = 0; i < works.length;i++)
            w.add(works[i]);
        int c = 0;
            
        int agg = 0;
        while (
            (agg < n) && 
            (!w.isEmpty())) {
            int p = w.poll();
            while ( 
                   (agg < n) && 
                   (p > 0) &&
                    !w.isEmpty() &&  
                    (p >= w.peek())
                  ) {
                agg++;
                p--;
            }
            if (p != 0)
                w.add(p);
        }
        
        while (!w.isEmpty()) {
            int p = w.poll();
            answer += Math.pow(p,2);
        }
        
        return answer;
    }
}