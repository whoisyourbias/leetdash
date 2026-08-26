import java.util.*;

class Solution {

    class Node {
        int indegree;
        int nodeNumber;
        ArrayDeque<Integer> toNodes;
        Node(int nodeNumber) {
            this.nodeNumber = nodeNumber;
            this.toNodes = new ArrayDeque<>();
        }
    }

    public boolean canFinish(int numCourses, int[][] prerequisites) {
        Node[] nodes = new Node[numCourses];
        for (int i = 0 ; i < numCourses; i++) {
            nodes[i] = new Node(i);
        }

        for (int[] p : prerequisites) {
            int from = p[1];
            int to = p[0];

            nodes[from].toNodes.add(to);
            nodes[to].indegree+=1;
        }

        // kahn의 알고리즘에서 위상정렬을 사용할때,
        // indegree가 0인 가지들을 먼저 제거해나가면서 처리한다.
        PriorityQueue<Node> pq = new PriorityQueue<>(
            (Node a, Node b) -> {
                return a.indegree - b.indegree;
            }
        );

        for (Node n : nodes) {
            if (n.indegree == 0)
                pq.add(n);
        }

        int c = 0;
        while (!pq.isEmpty()) {
            // indegree 0 인 노드 하나 가져와서 제거
            Node p = pq.poll();
            c++;
            // 이 노드가 향하는 모든 노드들에 대해서 
            // indegree decrease 처리.
            for (Integer to: p.toNodes) {
                nodes[to].indegree -= 1;
                if (nodes[to].indegree == 0)
                    pq.add(nodes[to]);
            }
        }

        if (c == numCourses)
            return true;
        return false;
    }


    // 우선순위가 있는 방향성 그래프에서는 union find를 사용하면안된다.
    // private int findParent(int[] courses, int x) {
    //     if (courses[x] == x)
    //         return x;
        
    //     return courses[x] = findParent(courses, courses[x]);
    // }

    // private boolean union(int a, int b) {
    //     int a1 = findParent(courses, a);
    //     int b1 = findParent(courses, b);

    //     if (a1 == b1) {
    //         return false;
    //     } else {
    //         courses[a] = a1;
    //         courses[b] = a1;
    //         return true;
    //     }
    // }
}