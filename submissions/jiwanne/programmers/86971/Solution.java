
import java.util.*;

class Solution {
    
    static int min_abs = Integer.MAX_VALUE;
    
    public int solution(int n, int[][] wires) {
        
        // n = 개수 , wires = 관계도
        int l = wires.length;
        
        
        for(int i = 0; i < l; i++) {
            
            List<Integer>[] graph = new ArrayList[n + 1];
            
            for(int j = 1; j < n + 1; j++) {
                graph[j] = new ArrayList<>();
            }
            
            for(int j = 0; j < l; j++) {
                if(i == j) continue;

                int cur_node = wires[j][0];
                int cur_to = wires[j][1];

                graph[cur_node].add(cur_to);
                graph[cur_to].add(cur_node);
            }
            
            boolean[] visited = new boolean[n + 1];
            
            int start_node = 1;
            int cnt = bfs(start_node , graph , visited);
            int diff = Math.abs(cnt - (n - cnt));
            min_abs = Math.min(diff,min_abs);
                
        }
            
        
        return min_abs;
    }
    
    int bfs (int start_node , List<Integer>[] graph , boolean[] visited) {
        int cnt = 1;
        
        Queue<Integer> q = new LinkedList<>();
        
        q.add(start_node);
        visited[start_node] = true;
        
        while(!q.isEmpty()) {
            int cur_node = q.poll();
            
            for(int next_node : graph[cur_node]) {
                
                if(visited[next_node]) continue;
                
                visited[next_node] = true;
                cnt++;
                q.offer(next_node);
                
            }
            
        }
        return cnt;
        
    }
    
}