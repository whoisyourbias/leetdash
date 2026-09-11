import java.util.*;

class Solution {
    class Edge {
        int to;
        int weight;
        Edge(int to, int weight) {this.to=to;this.weight=weight;}
    }
    
    class Node {
        int v;
        int cost;
        Node(int v, int cost) {this.v=v;this.cost=cost;}
    }
    
    public int solution(int N, int[][] roads, int K) {
        ArrayList<Edge>[] graph = new ArrayList[N+1]; 
        for (int i = 1; i <= N; i++) {
            graph[i] = new ArrayList<>();
        }
        
        for (int[] r : roads) {
            int a = r[0];
            int b = r[1];
            int c = r[2];
            
            graph[a].add(new Edge(b, c));
            graph[b].add(new Edge(a, c));
        }
        
        
        int[] dist = new int[N+1];
        Arrays.fill(dist, Integer.MAX_VALUE);
        PriorityQueue<Node> pq = new PriorityQueue<>(
        (a,b) -> {
            return Integer.compare(a.cost, b.cost);
        });
        
        //init
        dist[1] = 0;
        pq.add(new Node(1, 0));
        int answer = 0;
        while (!pq.isEmpty()) {
            Node d = pq.poll();
            
            if (d.cost > dist[d.v])
                continue;
            
            if (dist[d.v] <= K)
                answer++;
            for (Edge e : graph[d.v]) {
                // 현재 코스트 + 다음경로까지 비용이 다익스트라경로보다 작으면 pq add
                int next = e.to;
                int nextCost = d.cost + e.weight;
                
                if (nextCost < dist[next]) {
                    dist[next] = nextCost;
                    pq.add(new Node(next, nextCost));
                }
            }
        }

        
        return answer;
    }
}