import java.util.*;

// 위상정렬
// kahn -> indegree 0인거 먼저 처리.

class Solution {
    class Node {
        int courseID;
        int indegree;
        ArrayDeque<Integer> outdegrees;
        Node(int courseID) {
            this.courseID = courseID;
            this.indegree = 0;
            this.outdegrees = new ArrayDeque<>();
        }

        void increaseIndegree() {this.indegree++;}
        void decreaseIndegree() {this.indegree--;}
        void addOutdegree(int o) {this.outdegrees.add(o);}
    }

    public int[] findOrder(int n, int[][] prerequisites) {
        Node[] nodes = new Node[n];
        for (int i = 0; i < n; i++) {
            nodes[i] = new Node(i);
        }
        
        for (int[] p : prerequisites) {
            int from = p[1];
            int to = p[0];

            nodes[to].increaseIndegree();
            nodes[from].addOutdegree(to);
        }

        PriorityQueue<Node> pq = new PriorityQueue<>(
            (Node a, Node b) -> {
                return a.indegree - b.indegree;
            }
        );

        for (int i = 0; i < n; i++) {
            if (nodes[i].indegree == 0)
                pq.add(nodes[i]);
        }

        int[] answer = new int[n];
        int answerI = 0;
        while (!pq.isEmpty()) {
            Node zero_indegree = pq.poll();
            
            answer[answerI++] = zero_indegree.courseID;

            for (int to : zero_indegree.outdegrees) {
                nodes[to].decreaseIndegree();
                if (nodes[to].indegree == 0)
                    pq.add(nodes[to]);
            }
        }

        if (answerI != n)
            return new int[0];
        else 
            return answer;
    }
}