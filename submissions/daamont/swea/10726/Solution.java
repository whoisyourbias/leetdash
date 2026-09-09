import java.util.Scanner;

class Solution {
    public static void main(String args[]) throws Exception {

        Scanner sc = new Scanner(System.in);
        int T;
        T = sc.nextInt();

        for (int test_case = 1; test_case <= T; test_case++) {
            int N = sc.nextInt();
            int M = sc.nextInt();

            int change = (1 << N) - 1;

            if ((M & change) == change) {
                System.out.println("#" + test_case + " ON");
            } else {
                System.out.println("#" + test_case + " OFF");
            }
        }
    }
}