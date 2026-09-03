import java.util.*;


class Solution {
    
    static ArrayList<ArrayList<Node>> graph;
    
    static class Node {
        int idx , time;
        Node(int idx , int time) {
            this.idx = idx;
            this.time = time;
        }
    }

    public int solution(int N, int[][] road, int K) {
        int answer = 0;
        graph = new ArrayList<>();

        for(int i = 0 ; i <= N ; i++) {
            graph.add(new ArrayList<>());
        }

        for(int i = 0 ; i < road.length ; i++) {
            int a = road[i][0];
            int b = road[i][1];
            int c = road[i][2];

            // 무방향 그래프 설정
            graph.get(a).add(new Node(b , c));
            graph.get(b).add(new Node(a , c));
        }

        int[] dist = new int[N + 1];

        Arrays.fill(dist , Integer.MAX_VALUE);
        dist[1] = 0;


        // 다익스트라 돌리면서 dist 배열 갱신
        PriorityQueue<Node> pq = new PriorityQueue<>((o1 , o2) -> o1.time - o2.time);
        pq.add(new Node(1 , 0));

        while(!pq.isEmpty()) {
            Node node = pq.poll();

            if(node.time > dist[node.idx]) continue;

            for(Node next : graph.get(node.idx)) {
                if(dist[next.idx] > dist[node.idx] + next.time) {
                    dist[next.idx] = dist[node.idx] + next.time;
                    pq.add(new Node(next.idx , dist[next.idx]));
                }
            }
        }

        for(int i = 1 ; i <= N ; i++) {
            if(dist[i] <= K) answer++;
        }
        
        
        
        return answer;
    }
}