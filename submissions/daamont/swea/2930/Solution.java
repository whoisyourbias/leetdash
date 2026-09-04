import java.util.Collections;
import java.util.PriorityQueue;
import java.util.Scanner;

class Solution {
    public static void main(String args[]) throws Exception {
        Scanner sc = new Scanner(System.in);
        int T;
        T = sc.nextInt();

        for (int test_case = 1; test_case <= T; test_case++) {
            int num = sc.nextInt();

            PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Collections.reverseOrder());

            StringBuilder sb = new StringBuilder();
            sb.append("#").append(test_case);

            for (int i = 0; i < num; i++) {
                int type = sc.nextInt();

                if (type == 1) {
                    int x = sc.nextInt();
                    maxHeap.add(x);
                } else if (maxHeap.isEmpty()) {
                    sb.append("-1");
                } else {
                    sb.append(" ").append(maxHeap.poll());
                }
            }

            System.out.println(sb.toString());
        }
    }
}