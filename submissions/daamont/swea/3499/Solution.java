import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Scanner;

class Solution {
    public static void main(String args[]) throws Exception {
        Scanner sc = new Scanner(System.in);
        int T;
        T = sc.nextInt();

        for (int test_case = 1; test_case <= T; test_case++) {

            int size = sc.nextInt();

            int mid = (size + 1) / 2;

            Deque<String> d1 = new ArrayDeque<>();
            Deque<String> d2 = new ArrayDeque<>();

            for (int i = 0; i < mid; i++) {
                d1.add(sc.next());
            }

            for (int i = mid; i < size; i++) {
                d2.add(sc.next());
            }

            System.out.print("#" + test_case);

            while (!d1.isEmpty()) {
                System.out.print(" " + d1.poll());

                if (!d2.isEmpty()) {
                    System.out.print(" " + d2.poll());

                }
            } System.out.println();
        }
    }
}