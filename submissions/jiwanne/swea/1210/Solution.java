
import java.util.Queue;
import java.util.Scanner;


class Solution
{
	public static void main(String args[]) throws Exception
	{

		Scanner sc = new Scanner(System.in);
		int T = 10;

		for(int test_case = 1; test_case <= T; test_case++)
		{
            
            int num = sc.nextInt();
            int answer = 0;


            int [][] arr = new int [100][100];
            for (int i = 0; i < 100; i++) {
                for (int j = 0; j < 100; j++) {
                    arr[i][j] = sc.nextInt();
                }
            }
           


            for (int i = 0; i < 100; i++) {
                if (arr[99][i] == 2) {
                    int x = 99;
                    int y = i;

                    while (x > 0) {
                        if (y > 0 && arr[x][y - 1] == 1) {
                            while (y > 0 && arr[x][y - 1] == 1) {
                                y--;
                            }
                        } else if (y < 99 && arr[x][y + 1] == 1) {
                            while (y < 99 && arr[x][y + 1] == 1) {
                                y++;
                            }
                        }
                        x--;
                    }
                    answer = y;
                    break;
                }
            }


            
                




            System.out.println("#" + num + " " + answer);

		}
	}
}